#!/usr/bin/env bash
# Pruebas de humo contra un entorno desplegado.
#   ./scripts/smoke.sh https://achoflores-staging.onrender.com full   → flujo de compra completo (staging)
#   ./scripts/smoke.sh https://achoflores.onrender.com readonly       → solo lectura (producción)
set -euo pipefail
BASE="${1:?URL base}"; MODE="${2:-readonly}"
pass() { echo "✔ $1"; }
fail() { echo "::error::✘ $1"; exit 1; }
j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(($1)??'')})"; }

health=$(curl -fsS "$BASE/health") || fail "/health no responde"
[ "$(echo "$health" | j o.status)" = "ok" ] && pass "/health ok (commit $(echo "$health" | j o.commit))"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
[ "$code" = "200" ] && pass "PWA servida en /" || fail "la PWA respondió $code"

hdrs=$(curl -sI "$BASE/")
echo "$hdrs" | grep -qi "content-security-policy" && pass "cabecera CSP presente" || fail "falta Content-Security-Policy"
echo "$hdrs" | grep -qi "x-powered-by" && fail "x-powered-by expuesto" || pass "x-powered-by oculto"

catalog=$(curl -fsS "$BASE/api/catalog/products")
total=$(echo "$catalog" | j o.total)
[ "$total" -gt 0 ] && pass "catálogo público con $total productos" || fail "catálogo vacío"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/merchant/orders")
[ "$code" = "401" ] && pass "ruta protegida exige autenticación (401)" || fail "ruta protegida respondió $code"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'x-signature: 00' -d '{}' "$BASE/api/payments/webhook")
[ "$code" = "401" ] && pass "webhook rechaza firma inválida (401)" || fail "webhook respondió $code"

[ "$MODE" = "full" ] || { echo "Modo solo lectura: OK"; exit 0; }

email="smoke+$(date +%s)@achoflores.pe"
token=$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"smoke2026x\",\"name\":\"Prueba de humo\",\"acceptPrivacy\":true}" \
  "$BASE/api/auth/register" | j o.token)
[ -n "$token" ] && pass "registro de cliente" || fail "registro de cliente"
auth=(-H "Authorization: Bearer $token" -H 'Content-Type: application/json')

pid=$(echo "$catalog" | j "o.items.find(p=>p.stock>0)?.id")
[ -n "$pid" ] || fail "no hay productos con stock"
ck=$(curl -fsS "${auth[@]}" -X POST -d "{\"items\":[{\"productId\":\"$pid\",\"quantity\":1}],\"fulfillment\":\"PICKUP\",\"phone\":\"987654321\"}" "$BASE/api/checkout" | j o.id)
[ -n "$ck" ] && pass "checkout creado ($ck)" || fail "checkout"

status=$(curl -fsS "${auth[@]}" -X POST -d "{\"checkoutId\":\"$ck\",\"outcome\":\"approve\"}" "$BASE/api/sandbox-gateway/charges" | j o.status)
[ "$status" = "paid" ] && pass "pago sandbox aprobado" || fail "pago: $status"

final=$(curl -fsS "${auth[@]}" "$BASE/api/orders" | j "o[0].status")
[ "$final" = "PAID" ] && pass "«Mis pedidos» muestra la compra pagada" || fail "estado final: $final"
echo "Flujo de compra de punta a punta: OK"
