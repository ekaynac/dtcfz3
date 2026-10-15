# Okul Kütüphanesi

Hafif, Türkçe bir okul kütüphanesi kataloğu ve ödünç takip uygulaması. React + Vite arayüzü Vercel'de statik olarak yayımlanır; kalıcı kayıtlar Supabase PostgreSQL'de tutulur.

## İşlevler

- Herkese açık kitap kataloğu; kitap adı, yazar, kategori, raf ve müsait nüsha sayısı.
- Ziyaretçi kitap seçip kendi adını yazarak ödünç kaydı açar; hesap oluşturmaz.
- Tek kütüphaneci hesabı kitap ekler, düzenler, katalogdan kaldırır ve iadeyi kaydeder.
- Yönetici paneli katalog, müsait nüsha ve açık ödünç sayılarını; açık kayıtları alınma tarihine göre ve en uzun süredir ödünçte olanları gösterir.
- İade alındığında ödünç alanın adı silinir; kitap ve iade geçmişi korunur.
- Ödünç süresi/son teslim tarihi yoktur. Kayıt, admin iade edene kadar açık kalır.

## Gereksinimler

- Node.js 20.19+ veya 22.12+.
- Ücretsiz Supabase projesi ve Vercel hesabı.

Ücretsiz servis planlarının kota, uyku/duraklatma ve kullanım koşulları değişebilir. Supabase Free'de hareketsiz projeler duraklatılabilir. Vercel Hobby planı kişisel ve ticari olmayan kullanım içindir; okulun resmî kullanımı için uygunluğu okul adına doğrulanmalıdır.

## Supabase kurulumu

1. Supabase'de yeni bir proje oluşturun.
2. `supabase/migrations/` içindeki `.sql` dosyalarını ad sırasıyla Supabase Dashboard → **SQL Editor** bölümünde çalıştırın. Bu tabloları, erişim kurallarını, ödünç işlemi fonksiyonlarını ve rafı sonradan atayabilme desteğini kurar.
3. Authentication ayarlarında yeni kullanıcı kayıtlarını kapatın. Bir e-posta/şifre admin hesabını Dashboard → **Authentication → Users** bölümünden oluşturun.
4. SQL Editor'de `admin@example.com` değerini oluşturduğunuz admin e-postasıyla değiştirip şu sorguyu çalıştırın:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@example.com';
   ```

   Sorgu bir satırı güncellemelidir. Rol JWT'ye giriş sırasında işlendiğinden admin hesabından çıkış yapıp tekrar giriş yapın.
5. Project Settings → **API** bölümünden Project URL ve publishable/anon anahtarını alın. Anahtar `service_role` olmamalı ve hiçbir zaman frontend'e konmamalıdır.

## Yerelde çalıştırma

```sh
npm install
cp .env.example .env.local
```

`.env.local` içine Supabase değerlerini yazın:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Ardından:

```sh
npm run dev
```

Üretim derlemesi: `npm run build`; çıktı `dist/` dizinine yazılır.

## Vercel'e yayımlama

1. Kaynak kodu [GitHub deposunda](https://github.com/ekaynac/dtcfz3) tutulur.
2. Otomatik dağıtım için Vercel projesi `dtcfz3` > **Settings > Git** bölümünden bu depo bağlanıp production dalı `main` seçilmelidir.
3. `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` Vercel'de production, preview ve development ortamlarına tanımlıdır.
4. Canlı katalog: [dtcfz3.vercel.app](https://dtcfz3.vercel.app/); yönetici girişi `/admin`.

Vercel yönlendirmesi `vercel.json` içindeki SPA rewrite ile sağlanır. Yayınlamadan önce okulun Vercel planı koşullarını ve Supabase'in veri saklama/erişim tercihlerini onaylayın. Gerçek öğrenci verisi için okulun veri koruma kurallarına uyun; admin şifresini paylaşmayın.

## Güvenlik ve veri akışı

- Frontend'de yalnızca Supabase publishable/anon anahtarı bulunur; RLS kitapları ve ödünç alan adlarını korur.
- Anon ziyaretçiler sadece aktif katalog alanlarını okuyabilir ve `borrow_book` veritabanı fonksiyonuyla ödünç kaydı açabilir. Fonksiyon kitap satırını kilitleyerek son nüshanın eşzamanlı iki kez verilmesini önler.
- Ödünç kayıtları ve adlar yalnız JWT `app_metadata.role = admin` olan oturumlara açıktır. Admin rolü istemciden değiştirilemez.
- Kayıt açarken ad saklanır; admin iadeyi onaylayınca ad `NULL` yapılır. İade zamanı ve kitap bağlantısı geçmiş için kalır.
- Admin kitap nüshasını, açık ödünçteki nüsha sayısının altına indiremez. Kitap silinmez; katalogdan kaldırılır, böylece geçmiş bağlantısı kopmaz.

MIT lisanslıdır.
