"""Hazard-type classifier: TF-IDF (char + word n-grams) + multinomial logistic regression.

Trained at start-up from the seed corpus plus any editor-confirmed reports (see
scripts/retrain_classifier.py). Returns calibrated-ish probabilities and explicit
uncertainty flags; it never decides anything on its own.
"""
from __future__ import annotations

import re
import threading

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from .lexicon import CATEGORY_LABELS, KEYWORD_STEMS, TRAINING

MODEL_VERSION = "hazard-lr+lexicon-v1"
_WORD = re.compile(r"[a-zA-Z']+")
_STEM_RE = {c: [re.compile(r"\b" + re.escape(st)) for st in stems] for c, stems in KEYWORD_STEMS.items()}


def lexicon_scores(text: str) -> dict[str, int]:
    t = text.lower()
    return {c: sum(1 for rx in rxs if rx.search(t)) for c, rxs in _STEM_RE.items()}


def blend(classes: list[str], p_model: np.ndarray, text: str, w: float = 0.5) -> tuple[np.ndarray, bool]:
    """Blend learned probabilities with keyword evidence. Returns (probs, had_keyword_evidence)."""
    hits = lexicon_scores(text)
    total = sum(hits.values())
    if total == 0:
        return p_model, False
    p_lex = np.array([hits.get(c, 0) / total for c in classes])
    return (1 - w) * p_model + w * p_lex, True


def _build() -> Pipeline:
    feats = FeatureUnion([
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True, sublinear_tf=True)),
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), lowercase=True, sublinear_tf=True)),
    ])
    return Pipeline([("f", feats), ("lr", LogisticRegression(C=12, max_iter=2000))])


class HazardClassifier:
    def __init__(self, extra: list[tuple[str, str]] | None = None):
        data = list(TRAINING) + list(extra or [])
        self.texts = [t for t, _ in data]
        self.labels = [l for _, l in data]
        self.model = _build().fit(self.texts, self.labels)
        self.classes = list(self.model.classes_)
        self._vocab = set(self.model.named_steps["f"].transformer_list[1][1].vocabulary_)

    def predict(self, text: str) -> dict:
        text = (text or "").strip()
        if not text:
            return {"label": "other", "label_text": CATEGORY_LABELS["other"], "probs": {},
                    "confidence": 0.0, "uncertainty": ["empty_text"], "model": MODEL_VERSION}
        p_model = self.model.predict_proba([text])[0]
        proba, had_kw = blend(self.classes, p_model, text)
        order = np.argsort(proba)[::-1]
        top, second = proba[order[0]], proba[order[1]]
        label = self.classes[order[0]]

        flags: list[str] = []
        if not had_kw:
            flags.append("no_keyword_evidence")
        elif self.classes[int(np.argmax(p_model))] != self.classes[order[0]]:
            flags.append("model_and_keywords_disagree")
        words = _WORD.findall(text.lower())
        if len(words) < 4:
            flags.append("very_short_text")
        known = sum(1 for w in words if w in self._vocab)
        coverage = known / max(1, len(words))
        if coverage < 0.35:
            flags.append("mostly_unseen_vocabulary")
        if top - second < 0.12:
            flags.append("close_second_category")
        if top < 0.45:
            flags.append("low_probability")

        confidence = float(top)
        if "mostly_unseen_vocabulary" in flags:
            confidence *= 0.8
        if "very_short_text" in flags:
            confidence *= 0.85

        return {
            "label": label,
            "label_text": CATEGORY_LABELS.get(label, CATEGORY_LABELS["other"]),
            "probs": {self.classes[i]: round(float(proba[i]), 3) for i in order},
            "confidence": round(confidence, 3),
            "uncertainty": flags,
            "model": MODEL_VERSION,
        }

    def cross_val_accuracy(self, folds: int = 4, repeats: int = 5) -> float:
        """Repeated stratified CV of the full blended predictor (model refit per fold)."""
        from sklearn.model_selection import RepeatedStratifiedKFold
        X, y = np.array(self.texts, dtype=object), np.array(self.labels)
        accs = []
        for tr, te in RepeatedStratifiedKFold(n_splits=folds, n_repeats=repeats, random_state=3).split(X, y):
            m = _build().fit(list(X[tr]), list(y[tr]))
            correct = 0
            for t, lab in zip(X[te], y[te]):
                p, _ = blend(list(m.classes_), m.predict_proba([t])[0], t)
                correct += int(m.classes_[int(np.argmax(p))] == lab)
            accs.append(correct / len(te))
        return float(np.mean(accs))

    def accuracy_on(self, examples: list[tuple[str, str]]) -> float:
        return float(np.mean([self.predict(t)["label"] == l for t, l in examples]))


_lock = threading.Lock()
_instance: HazardClassifier | None = None


def get_classifier() -> HazardClassifier:
    global _instance
    with _lock:
        if _instance is None:
            _instance = HazardClassifier()
        return _instance
