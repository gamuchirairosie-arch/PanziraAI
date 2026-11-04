#!/usr/bin/env bash
# Demo helpers: fake Africa's Talking / WhatsApp callbacks against a local server.
# usage: BASE=http://localhost:8000 KEY=your-at-secret ./scripts/simulate.sh
BASE=${BASE:-http://localhost:8000}; KEY=${KEY:-}; PHONE=${PHONE:-+263772000111}
q=""; [ -n "$KEY" ] && q="?key=$KEY"
ussd() { curl -s -X POST "$BASE/webhooks/africastalking/ussd$q" -d "sessionId=${SID:-demo1}" -d "phoneNumber=$PHONE" -d "serviceCode=*123#" --data-urlencode "text=$1"; echo; }
echo "--- USSD ---"; ussd ""; ussd "1"; ussd "1*3"; ussd "1*3*1"; ussd "1*3*1*Plumtree turn-off"; ussd "1*3*1*Plumtree turn-off*1"
echo "--- SMS ---"
curl -s -X POST "$BASE/webhooks/africastalking/sms$q" -d "from=$PHONE" -d "to=12345" -d "id=sim-$RANDOM" --data-urlencode "text=CRASH Plumtree road Gwanda 2 vehicles"; echo
