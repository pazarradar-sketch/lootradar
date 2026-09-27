# Pazar Radar

Türkiye için oyun pazarı fiyat radarı. Statik site (`docs/`) + saatlik GitHub Actions toplayıcı (`scraper/`). Sunucu yok, veritabanı yok: veriler `docs/data/*.json` olarak depoya yazılır.

## Ne var
- **Knight Online GB**: ByNoGame, GameSatış, Kopazar, Oyunfor (doğrudan) + BursaGB (KO Rehberi toplayıcısı) — sunucu bazlı alış/satış, en iyi alış, USD, makas, geçmiş grafiği, "elimdeki GB kaç TL eder" hesabı.
- **CS2 nakit çıkış**: CSFloat fiyat listesi + Skinport ürün listesi (saatlik) + Steam en popüler 300 ürün; Türkiye'den her rotada (CSFloat→Stripe, itemsatis, ByNoGame Bize Sat, Steam-cüzdan) eline geçecek net TL.
- **Kur**: open.er-api.com + TCMB.

## Çalıştırma
```bash
npm run scrape        # hepsi (Steam 30 sayfa ≈ 2,5 dk; 429'da durur)
STEAM_PAGES=0 npm run scrape:cs2   # Steam'e dokunmadan CSFloat+Skinport
npm run scrape:ko     # yalnızca KO + kur
node scraper/index.js tr       # yalnızca Türk pazarları (itemsatis + ByNoGame) → cs2_tr.json
node scraper/index.js trends   # yalnızca ko_trends.json'i yeniden hesapla (ağ yok)
node scraper/index.js signals  # yalnızca cs2_history/cs2_signals'ı yeniden üret (ağ yok)
npm run dev           # http://127.0.0.1:4410  (docs/ klasörünü sunar)
```

## Veri dosyaları
- `ko_latest.json` — son fiyatlar, kaynak durumu
- `ko_history.json` — 90 gün saatlik anlık görüntüler `[ts, [[kaynak, sunucu, alış, satış], …]]`
- `ko_daily.json` — 90 günden eski günlük özet
- `ko_trends.json` — sunucu başına trend/sinyal özeti (`scraper/trends.js`, KO adımından sonra üretilir): `bestBuy {src, price}`, `bestSell` (en düşük satış), `spreadPct`; "en iyi alış" serisi (anlık görüntü başına kaynaklar arası en yüksek alış) üzerinden `change1h/24h/7d/30d` (%, veri yetersizse null), `min7d/max7d/min30d/max30d`, `positionIn30d` (0..1), `sparkline7d` (≤84 nokta `[ts, fiyat]`), `volatility7d` (saatlik % değişim std. sapması), `dataDays`, `signal {trend: up|down|flat (24s ve 7g ±%1,5 uyumu), stance: sell|buy|hold (30g konumu ≥0,85 → sat, ≤0,15 → al; <1 gün veride hold), confidence: low|med|high (<3 gün / <14 gün / daha fazla), reasonTR, reasonEN}`
- `cs2.json` — `{ name: [csfloatMin, csfloatQty, skMin, skMedian, skQty, steamAsk, steamListings] }`
- `cs2_history.json` — günde bir (UTC) kompakt kayıt, 180 gün: `{ days: { "YYYY-MM-DD": { name: [csfloatMin, skMin, steamAsk] } } }` — Skinport adedine göre ilk 600 ürün + Steam fiyatı olan her ürün (`scraper/cs2history.js`)
- `cs2_signals.json` — `routes.{sk2cf, cf2st, st2cf}`: orana göre ilk 100 `[name, buy, sell, net, ratio, qtyA, qtyB]` (iki taraf adet ≥ 20, fiyat ≥ 1 USD); `changes: { name: [change7d, change30d] }` (cs2_history'den, CSFloat fiyatı; veri yoksa yok); `liquid`: Skinport adedine göre ilk 200 `[name, cf, sk, skMed, st, skQty, cfQty, change7d]`; `fees`. Ücret modeli: CSFloat net = fiyat×0,98×0,975, Steam net = fiyat×0,87
- `cs2_tr.json` — Türk pazarlarında TL ilan fiyatları (`scraper/tr.js`, `node scraper/index.js tr`): `{ ts, sources: { itemsatis: {ok, pages, n, matched}, bynogame: {ok, pages, n, matched, note} }, items: { market_hash_name: { itemsatisMinTL, itemsatisN, itemsatisUrl, bynogameMinTL, bynogameN, bynogameSellUsTL } }, unmatched: [ilk 50 başlık] }`. itemsatis: `/ilanlar/cs-2-skins.html` 10 sayfa (HTML); ByNoGame: sayfa Vue ile çizildiğinden sitenin açık JSON ucu `gw.bynogame.com/steam-products/v2/products` (stok sırasına göre 10×100 ürün; Türkçe adlar itemsatis eşleştirme sözlüğü olarak da kullanılır). Başlık→market_hash_name eşleştirme sezgisel: küçük harf/aksan katlama, "|"/parantez/emoji temizliği, FT/MW/FN/WW/BS ve Türkçe aşınma sözcükleri, "kasa"→Case vb.; yalnızca tüm token'ları tek adayda bulunan ve aşınma/StatTrak'ı eşleşen başlıklar alınır. İstekler arası 1,5 sn.
- `fx.json`, `meta.json`

## Notlar
- Kopazar ve Oyunfor 10M başına fiyat verir; ×10 ile 1 GB'ye çevrilir.
- Steam anonim arama sayfa başına 10 ürün verir; istekler 4,2 sn aralıklı, ilk 429'da durur ve eski değerler korunur.
- Skinport API saatte ~100 istek sınırı; biz saatte 1 istek atıyoruz.
