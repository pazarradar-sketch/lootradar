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
npm run dev           # http://127.0.0.1:4410  (docs/ klasörünü sunar)
```

## Veri dosyaları
- `ko_latest.json` — son fiyatlar, kaynak durumu
- `ko_history.json` — 90 gün saatlik anlık görüntüler `[ts, [[kaynak, sunucu, alış, satış], …]]`
- `ko_daily.json` — 90 günden eski günlük özet
- `cs2.json` — `{ name: [csfloatMin, csfloatQty, skMin, skMedian, skQty, steamAsk, steamListings] }`
- `fx.json`, `meta.json`

## Notlar
- Kopazar ve Oyunfor 10M başına fiyat verir; ×10 ile 1 GB'ye çevrilir.
- Steam anonim arama sayfa başına 10 ürün verir; istekler 4,2 sn aralıklı, ilk 429'da durur ve eski değerler korunur.
- Skinport API saatte ~100 istek sınırı; biz saatte 1 istek atıyoruz.
