"""Static safeguards for SQLAlchemy model declarations.

These checks intentionally parse source instead of importing the application, so they can
run before native scientific dependencies are installed.
"""

from __future__ import annotations

import ast
import pathlib
import unittest


BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL_FILES = (
    BACKEND_ROOT / "app" / "models.py",
    BACKEND_ROOT / "app" / "database" / "models.py",
)


def declared_names(statement: ast.stmt) -> list[str]:
    if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
        return [statement.target.id]
    if isinstance(statement, ast.Assign):
        return [target.id for target in statement.targets if isinstance(target, ast.Name)]
    return []


class ModelDeclarationTests(unittest.TestCase):
    def test_model_classes_do_not_redeclare_attributes(self) -> None:
        duplicates: list[str] = []

        for model_file in MODEL_FILES:
            tree = ast.parse(model_file.read_text(encoding="utf-8"), filename=str(model_file))
            for node in (item for item in tree.body if isinstance(item, ast.ClassDef)):
                seen: set[str] = set()
                for statement in node.body:
                    for name in declared_names(statement):
                        if name in seen:
                            duplicates.append(f"{model_file.name}:{node.name}.{name}")
                        seen.add(name)

        self.assertEqual([], duplicates, f"Duplicate model attributes: {duplicates}")


if __name__ == "__main__":
    unittest.main()
