# Türkiye pmtiles extract'ı üretme

Varsayılan olarak BFF, Protomaps planet dosyasını (`data.source.coop`, 134 GB)
range-request ile okur — dosyayı indirmez, sadece istenen tile'ın byte'larını çeker.
Bu geliştirme için yeterli ama üretimde:

- her tile isteği uzak sunucuya bir HTTP range çağrısı yapar (yavaş, kırılgan),
- "Bu bölgeyi indir" çevrimdışı paketi çok sayıda tile çeker.

Üretim için Türkiye'yi kapsayan yerel bir `.pmtiles` çıkarın.

## Yöntem — pmtiles CLI ile extract (en hızlı)

`pmtiles` CLI (Go): https://github.com/protomaps/go-pmtiles/releases

```bash
# Türkiye + çevre denizleri kutusu (Faz 1'deki parseLatLon ile aynı):
#   batı 25, güney 34, doğu 45, kuzey 43.5
pmtiles extract \
  https://data.source.coop/protomaps/openstreetmap/v4.pmtiles \
  turkey.pmtiles \
  --bbox=25,34,45,43.5 \
  --maxzoom=14
```

Sonuç ~birkaç yüz MB. Fly volume'a veya R2/B2'ye koyun, sonra:

```bash
PMTILES_URL=/data/turkey.pmtiles   # yerel dosya
# veya
PMTILES_URL=https://<r2-bucket>/turkey.pmtiles   # uzak (range destekli)
```

`sources/pmtiles.ts` her ikisini de destekler (yerel için `NodeFileSource`).

## Güncelleme

Protomaps planet haftalık güncellenir. Ayda bir extract'ı yenilemek yeter
(kıyı şeridi, limanlar nadiren değişir). Cron ile otomatikleştirilebilir.
