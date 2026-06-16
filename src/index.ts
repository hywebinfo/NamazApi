import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { ALL_PLACES } from "../data/geoData.js";
import { getPlace, findPlace, getTimes } from "../api_src/calculator.js";
import {
  getCommonTimeRequestParameters,
  getParamsForPlaceSearch,
  isInRange,
} from "../api_src/util.js";
import { getPlaceSuggestionsByText, getNearbyPlaces, getPlaceById } from "irem";

import { Context } from "hono";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (
        process.env["ENABLE_CORS"] ||
        origin === "http://localhost" ||
        origin === "https://localhost" ||
        origin === "capacitor://localhost"
      ) {
        return origin;
      }
      return null;
    },
  }),
);

app.get("/privacy-policy", getPrivacyPolicy);
app.get("/privacy-policy-android", getPrivacyPolicyAndroid);
app.get("/api/searchPlaces", searchPlaces);
app.get("/api/nearByPlaces", nearByPlaces);
app.get("/api/timesForGPS", getTimesForGPS);
app.get("/api/timesForPlace", getTimesForPlace);
app.get("/api/timesFromCoordinates", getTimesFromCoordinates);
app.get("/api/timesFromPlace", getTimesFromPlace);
app.get("/api/countries", getCountries);
app.get("/api/regions", getRegionsOfCountry);
app.get("/api/cities", getCitiesOfRegion);
app.get("/api/coordinates", getCoordinateData);
app.get("/api/place", getPlaceData);
app.get("/api/placeById", placeById);
app.get("/api/ip", getIPAdress);
app.post("/api/timesFromCoordinates", getTimesFromCoordinates);
app.post("/api/timesFromPlace", getTimesFromPlace);
app.post("/api/countries", getCountries);
app.post("/api/regions", getRegionsOfCountry);
app.post("/api/cities", getCitiesOfRegion);
app.post("/api/coordinates", getCoordinateData);
app.post("/api/place", getPlaceData);
app.post("/api/placeById", placeById);
app.post("/api/ip", getIPAdress);

/** get a list of countries
 */
function getCountries(c: Context) {
  try {
    const r = [];
    for (const place in ALL_PLACES) {
      r.push({ code: ALL_PLACES[place].code, name: place });
    }
    c.header("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    return c.json(r.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    console.log("error! ", e);
    return c.json({ error: String(e) });
  }
}

function getRegionsOfCountry(c: Context) {
  const country = c.req.query("country") as string;
  if (!country || country === "undefined" || country === "null") {
    return c.json({ error: "Invalid country parameter!" }, 400);
  }
  if (ALL_PLACES[country]) {
    c.header("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    return c.json(
      Object.keys(ALL_PLACES[country].regions).sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  } else {
    return c.json({ error: "NOT FOUND!" }, 404);
  }
}

function getCitiesOfRegion(c: Context) {
  const country = c.req.query("country") as string;
  const region = c.req.query("region") as string;
  if (!country || country === "undefined" || country === "null") {
    return c.json({ error: "Invalid country parameter!" }, 400);
  }
  if (!region || region === "undefined" || region === "null") {
    return c.json({ error: "Invalid region parameter!" }, 400);
  }
  if (ALL_PLACES[country] && ALL_PLACES[country].regions[region]) {
    c.header("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    return c.json(
      Object.keys(ALL_PLACES[country].regions[region]).sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  } else {
    return c.json({ error: "NOT FOUND!" }, 404);
  }
}

function getCoordinateData(c: Context) {
  const country = c.req.query("country") as string;
  const region = c.req.query("region") as string;
  const city = c.req.query("city") as string;
  const coords = getPlace(country, region, city);
  if (coords) {
    return c.json(coords);
  } else {
    return c.json({ error: "NOT FOUND!" });
  }
}

/**
 * DEPRECATED, use `getTimesForGPS`
 */
function getTimesFromCoordinates(c: Context) {
  const lat = Number(c.req.query("lat") as string);
  const lng = Number(c.req.query("lng") as string);
  const { date, days, tzOffset, calculateMethod } =
    getCommonTimeRequestParameters(c);
  if (
    isNaN(lat) ||
    isNaN(lng) ||
    !isInRange(lat, -90, 90) ||
    !isInRange(lng, -180, 180)
  ) {
    return c.json({ error: "Invalid coordinates!" });
  } else if (days > 1000) {
    return c.json({ error: "days can be maximum 1000!" });
  } else {
    const place = findPlace(lat, lng);
    const times = getTimes(lat, lng, date, days, tzOffset, calculateMethod);
    return c.json({ place, times });
  }
}

async function getTimesForGPS(c: Context) {
  const { lat, lng, lang } = getParamsForPlaceSearch(c);
  const { date, days, tzOffset, calculateMethod } =
    getCommonTimeRequestParameters(c);
  if (
    isNaN(lat) ||
    isNaN(lng) ||
    !isInRange(lat, -90, 90) ||
    !isInRange(lng, -180, 180)
  ) {
    return c.json({ error: "Invalid coordinates!" });
  } else if (days > 1000) {
    return c.json({ error: "days can be maximum 1000!" });
  } else {
    const [place] = await getNearbyPlaces(lat, lng, lang, 1);
    const times = getTimes(lat, lng, date, days, tzOffset, calculateMethod);
    return c.json({ place, times });
  }
}

async function searchPlaces(c: Context) {
  const q = (c.req.query("q") ?? "") as string;
  const { lat, lng, lang, resultCount, countryCode } =
    getParamsForPlaceSearch(c);
  return c.json(
    await getPlaceSuggestionsByText(
      q,
      lang,
      lat,
      lng,
      resultCount,
      countryCode,
    ),
  );
}

async function nearByPlaces(c: Context) {
  try {
    const { lat, lng, lang, resultCount } = getParamsForPlaceSearch(c);
    const places = await getNearbyPlaces(lat, lng, lang, resultCount);
    return c.json(places);
  } catch (e) {
    console.error("nearByPlaces error:", e);
    return c.json({ error: String(e) }, 500);
  }
}

function getPlaceData(c: Context) {
  const lat = Number(c.req.query("lat") as string);
  const lng = Number(c.req.query("lng") as string);
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    return c.json({ error: "INVALID coordinates!" });
  } else {
    return c.json(findPlace(lat, lng));
  }
}

async function getTimesForPlace(c: Context) {
  const placeId = Number(c.req.query("id"));
  if (Number.isNaN(placeId)) {
    return c.json({ error: "Id should be a positive integer!" });
  }
  const { date, days, tzOffset, calculateMethod } =
    getCommonTimeRequestParameters(c);
  const { lang } = getParamsForPlaceSearch(c);
  const place = await getPlaceById(placeId, lang);

  if (!place) {
    return c.json({ error: "Place cannot be found!" });
  } else if (days > 1000) {
    return c.json({ error: "days can be maximum 1000!" });
  } else {
    const lat = place.latitude;
    const lng = place.longitude;
    const times = getTimes(lat, lng, date, days, tzOffset, calculateMethod);
    return c.json({ place, times });
  }
}

async function placeById(c: Context) {
  const placeId = Number(c.req.query("id"));
  if (Number.isNaN(placeId)) {
    return c.json({ error: "Id should be a positive integer!" });
  }
  const { lang } = getParamsForPlaceSearch(c);
  const place = await getPlaceById(placeId, lang);

  if (!place) {
    return c.json({ error: "Place cannot be found!" });
  } else {
    return c.json({ ...place });
  }
}

/**
 * DEPRECATED, use `getTimesForPlace`
 */
function getTimesFromPlace(c: Context) {
  const country = c.req.query("country") as string;
  const region = c.req.query("region") as string;
  const city = c.req.query("city") as string;
  const place = getPlace(country, region, city);
  const { date, days, tzOffset, calculateMethod } =
    getCommonTimeRequestParameters(c);
  if (!place) {
    return c.json({ error: "Place cannot be found!" });
  } else if (days > 1000) {
    return c.json({ error: "days can be maximum 1000!" });
  } else {
    const lat = place.latitude;
    const lng = place.longitude;
    const times = getTimes(lat, lng, date, days, tzOffset, calculateMethod);
    return c.json({ place, times });
  }
}

function getIPAdress(c: Context) {
  return c.json({ IP: c.req.header("x-forwarded-for") });
}

/**
 * Kuran Fihristi uygulaması için gizlilik politikası sayfası.
 */
function getPrivacyPolicy(c: Context) {
  const appName = "Kuran Fihristi";
  const lastUpdated = "17 Mayıs 2026";

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${appName} Gizlilik Politikası</title>
<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: sans-serif;
    line-height: 1.6;
    color: #333;
  }
  .header { margin-bottom: 32px; text-align: center; }
  .title { font-size: 2.25rem; font-weight: bold; color: #111; }
  .section { margin-bottom: 24px; }
  .sectionTitle {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 32px;
    margin-bottom: 16px;
    color: #222;
  }
  .paragraph { margin-bottom: 1em; }
  .strong { font-weight: 600; }
  .list { list-style-type: disc; padding-left: 20px; margin-bottom: 1em; }
  .listItem { margin-bottom: 0.5em; }
  .link { color: #007bff; text-decoration: none; }
  .link:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
  <header class="header">
    <h1 class="title">${appName} Gizlilik Politikası</h1>
  </header>

  <section class="section">
    <p class="paragraph">
      <strong class="strong">Son güncelleme:</strong> ${lastUpdated}
    </p>
    <p class="paragraph">
      ${appName}, kullanıcı gizliliğine saygı duyan, gelir elde etmeyen bir uygulamadır. Uygulamada reklam, kullanıcı takibi, analitik SDK'sı veya kişisel verilerin satışı bulunmaz.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">1. Toplanan Bilgiler</h2>
    <p class="paragraph">
      ${appName} hesap oluşturmaz ve ad, soyad, e-posta adresi, telefon numarası gibi kimlik bilgilerini toplamaz.
    </p>
    <p class="paragraph">
      Uygulama içinde aşağıdaki bilgiler yalnızca özelliklerin çalışması için kullanılabilir:
    </p>
    <ul class="list">
      <li class="listItem"><strong class="strong">Konum bilgisi:</strong> Kıble yönünü hesaplamak ve istenirse namaz vakitlerini bulunduğunuz yere göre göstermek için kullanılır.</li>
      <li class="listItem"><strong class="strong">Şehir arama bilgisi:</strong> Namaz vakitleri için şehir araması yaptığınızda arama metni ilgili hizmete gönderilebilir.</li>
      <li class="listItem"><strong class="strong">Fotoğraf arşivine ekleme izni:</strong> Oluşturduğunuz ayet görsellerini cihaz galerinize kaydetmek istediğinizde kullanılır.</li>
      <li class="listItem"><strong class="strong">Bildirim izni:</strong> Ayet hatırlatmaları göndermek istediğinizde kullanılır.</li>
    </ul>
  </section>

  <section class="section">
    <h2 class="sectionTitle">2. Cihazda Saklanan Veriler</h2>
    <p class="paragraph">Aşağıdaki bilgiler cihazınızda yerel olarak saklanır:</p>
    <ul class="list">
      <li class="listItem">Yer imleri ve sabitlenen ayetler</li>
      <li class="listItem">Kendi tefekkür notlarınız</li>
      <li class="listItem">Seçtiğiniz meal, yazı boyutu, tema ve sıralama tercihleri</li>
      <li class="listItem">Ayet hatırlatma saatleri</li>
      <li class="listItem">Namaz vakti için seçtiğiniz şehir ve önbelleğe alınmış vakit bilgileri</li>
    </ul>
    <p class="paragraph">
      Bu veriler geliştiriciye gönderilmez; uygulamayı kaldırdığınızda cihazdan silinir.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">3. Üçüncü Taraf Hizmetler</h2>
    <p class="paragraph">
      Namaz vakitleri ve şehir arama özellikleri için uygulama, <strong class="strong">namaz-api-steel.vercel.app</strong> hizmetine istek gönderebilir. Bu isteklerde, özelliğin çalışması için şehir arama metni veya konum koordinatları yer alabilir.
    </p>
    <p class="paragraph">
      Kıble hesaplaması cihaz üzerinde yapılır. Konum bilgisi bu özellik için ayrıca bir sunucuya gönderilmez.
    </p>
    <p class="paragraph">
      Uygulama ayrıca <strong class="strong">Firebase</strong> altyapısını kullanır. Firebase Analytics, uygulamanın nasıl kullanıldığını anlamaya yardımcı olmak için kullanım istatistiklerini; Firebase Crashlytics ise uygulama hatalarını tespit etmek ve düzeltmek için çökme raporları ile teknik tanılama verilerini işleyebilir. Reklam hizmetleri kullanılmaz. Firebase ayrıca hizmetlerini sağlamak ve yönetmek için uygulama kimliği, bundle kimliği, IP adresi ve teknik hizmet kullanım bilgileri gibi Firebase hizmet verilerini işleyebilir.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">4. Verilerin Kullanım Amaçları</h2>
    <ul class="list">
      <li class="listItem">Uygulama ayarlarınızı hatırlamak</li>
      <li class="listItem">Kıble yönünü göstermek</li>
      <li class="listItem">Namaz vakitlerini sunmak</li>
      <li class="listItem">Ayet hatırlatmalarını planlamak</li>
      <li class="listItem">Oluşturduğunuz ayet görsellerini cihazınıza kaydetmek</li>
    </ul>
  </section>

  <section class="section">
    <h2 class="sectionTitle">5. Reklam, Gelir ve Takip</h2>
    <p class="paragraph">
      ${appName}'nden gelir elde edilmemektedir. Uygulama reklam göstermez, kullanıcıları uygulamalar veya web siteleri arasında takip etmez ve verileri pazarlama amacıyla kullanmaz.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">6. İzinlerin Yönetimi</h2>
    <p class="paragraph">
      Konum, bildirim ve fotoğraf izinlerini dilediğiniz zaman iOS Ayarlar uygulamasından değiştirebilirsiniz. Bu izinleri vermemek, yalnızca ilgili özelliğin çalışmasını etkiler; uygulamanın temel okuma ve arama özellikleri kullanılmaya devam eder.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">7. Çocukların Gizliliği</h2>
    <p class="paragraph">
      Uygulama bilerek çocuklardan kişisel bilgi toplamaz.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">8. Politika Değişiklikleri</h2>
    <p class="paragraph">
      Bu gizlilik politikası gerektiğinde güncellenebilir. Güncel sürüm bu sayfada yayımlandığı tarihten itibaren geçerlidir.
    </p>
  </section>

  <section class="section">
    <h2 class="sectionTitle">9. İletişim</h2>
    <p class="paragraph">
      Gizlilik politikasıyla ilgili sorularınız için geliştiriciyle uygulamanın App Store sayfasındaki destek kanalı üzerinden iletişime geçebilirsiniz.
    </p>
  </section>
</div>
</body>
</html>`;

  return c.html(html);
}

/**
 * Kuran Fihristi (Android) için gizlilik politikası sayfası.
 * ?lang=tr (varsayılan) veya ?lang=en ile dil seçilebilir.
 */
function getPrivacyPolicyAndroid(c: Context) {
  const lang = c.req.query("lang") === "en" ? "en" : "tr";
  const email = "javadheybatzade@gmail.com";
  const apiUrl = "https://vakit.vercel.app";
  const effectiveDate = "1 Kasım 2025";

  const styles = `
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 2rem auto; max-width: 800px; color: #222; padding: 0 1rem; }
    h1, h2, h3 { color: #0d4a42; }
    ul { padding-left: 1.2rem; }
    a { color: #0d4a42; }
    .langSwitch { text-align: right; font-size: 0.9rem; margin-bottom: 1rem; }`;

  const tr = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kuran Fihristi Gizlilik Politikası</title>
<style>${styles}</style>
</head>
<body>
  <div class="langSwitch"><a href="?lang=en">English</a> | <strong>Türkçe</strong></div>
  <h1>Gizlilik Politikası</h1>
  <p>Yürürlük tarihi: ${effectiveDate}</p>
  <p>Kuran Fihristi ("biz"), Jetpack Compose ile geliştirilmiş, öncelikli olarak çevrimdışı çalışan bir Kuran referans uygulamasıdır. Bu Gizlilik Politikası, uygulamayı kullandığınızda bilgileri nasıl işlediğimizi açıklar. Uygulamayı yükleyerek veya kullanarak burada açıklanan uygulamaları kabul etmiş olursunuz.</p>

  <h2>1. Genel Bakış</h2>
  <p>Kuran Fihristi'ni hesap oluşturmanızı veya kişisel veri paylaşmanızı gerektirmeden çalışacak şekilde tasarladık. Özelliklerin çoğu tamamen cihazınızda çalışır. Yalnızca belirli işlevler için gereken izinleri isteriz ve bu izinleri istediğiniz zaman cihaz ayarlarınızdan denetleyebilirsiniz.</p>

  <h2>2. Topladığımız Bilgiler</h2>
  <p>Kişisel kimlik bilgisi, iletişim bilgisi, analitik veya reklam verisi toplamaz veya saklamayız. Uygulama, temel özellikleri çalıştırmak için aşağıdaki bilgileri işler:</p>
  <h3>Hassas veya Yaklaşık Konum (isteğe bağlı)</h3>
  <ul>
    <li>Kıble pusulası için kendinizi konumlandırmak veya yerel namaz vakitlerini almak istediğinizde kullanılır.</li>
    <li>Konum koordinatları cihazınızda işlenir ve namaz vakitlerini istediğinizde, programı hesaplamak için <a href="${apiUrl}/" rel="noopener noreferrer" target="_blank">Namaz Vakitleri API'sine</a> gönderilir.</li>
    <li>Konum erişimini reddedebilirsiniz; bu durumda bunun yerine elle şehir araması yapabilirsiniz. Bir şehir aradığınızda, yazdığınız metin eşleşen konumları döndürmek için aynı Namaz Vakitleri API'sine gönderilir.</li>
  </ul>
  <h3>Kaydedilen Yerler ve Tercihler</h3>
  <ul>
    <li>Tercih ettiğiniz bir şehri, hesaplama yöntemini, yazı boyutunu, karanlık modu veya ayet hatırlatmalarını kaydederseniz, uygulama bu bilgileri Android SharedPreferences kullanarak cihazınızda yerel olarak saklar.</li>
    <li>Bu ayarları, uygulamayı kaldırarak veya cihaz ayarlarından uygulamanın verilerini temizleyerek silebilirsiniz.</li>
  </ul>
  <h3>Çevrimdışı Kuran Veritabanı ve Ayet Yönetimi</h3>
  <ul>
    <li>Kuran metni, sözlük girdileri ve konu dizinleri uygulamayla birlikte gelir ve cihazınızda kalır.</li>
    <li>Sabitlenen ayetler, yer imleri ve diğer notlar, cihaz üzerindeki bir Room veritabanı kullanılarak yerel olarak saklanır ve hiçbir yere iletilmez.</li>
  </ul>
  <h3>Oluşturduğunuz Görseller</h3>
  <ul>
    <li>Ayetlerin görselini paylaştığınızda veya indirdiğinizde, görsel cihazınızda oluşturulur ve geçici bir önbellek klasörüne ya da indirmeyi seçerseniz Resimler dizininize kaydedilir.</li>
    <li>Paylaşılan görselleri galerinizden silerek veya uygulamanın önbelleğini temizleyerek kaldırabilirsiniz.</li>
  </ul>
  <h3>Cihaz Sensörleri</h3>
  <ul>
    <li>Kıble pusulası, yönü hesaplamak için ivmeölçer ve manyetometre verilerini okur. Bu okumalar gerçek zamanlı olarak işlenir; asla saklanmaz veya başka bir yere gönderilmez.</li>
  </ul>

  <h2>3. Bilgileri Nasıl Kullanırız</h2>
  <p>Yukarıda listelenen bilgileri yalnızca temel işlevleri sağlamak, sürdürmek ve geliştirmek için kullanırız:</p>
  <ul>
    <li>Mevcut yönelimnize göre Kıble yönünü hesaplamak.</li>
    <li>Seçtiğiniz konum için doğru namaz vakitlerini göstermek.</li>
    <li>Tercih ettiğiniz mealleri, temaları, yazı boyutlarını ve hatırlatmaları hatırlamak.</li>
    <li>Kişisel çalışmanız için ayetleri sabitlemenize, yer imlerine eklemenize, kopyalamanıza veya paylaşmanıza olanak tanımak.</li>
  </ul>

  <h2>4. Veri Paylaşımı ve Üçüncü Taraflar</h2>
  <ul>
    <li><strong>Namaz Vakitleri API'si:</strong> Namaz programlarını istediğinizde, <code>${apiUrl}</code> adresinde barındırılan üçüncü taraf hizmeti çağırırız. İstek, seçtiğiniz konumu (enlem/boylam veya şehir), tarih aralığını, saat dilimi farkını ve seçilen hesaplama yöntemini içerir. Başka kişisel veri iletilmez.</li>
    <li><strong>Google Play Hizmetleri:</strong> Uygulama, GPS/Wi-Fi sinyallerine erişmek için Google Play Hizmetleri Konum API'lerini kullanır. Google tarafından işlenen konum verileri Google'ın kendi gizlilik koşullarına tabidir.</li>
    <li><strong>Sistem Paylaşımı:</strong> İçerik paylaştığınızda (ör. ayet görselleri) dosyayı veya metni Android'in paylaşım sayfasına aktarırız. Sonraki dağıtım, seçtiğiniz hedef uygulamalara bağlıdır.</li>
    <li>Reklam ağları, analitik sağlayıcıları, çökme raporlayıcıları veya sosyal giriş kullanmayız.</li>
  </ul>

  <h2>5. Veri Saklama, Tutma ve Güvenlik</h2>
  <ul>
    <li>Tüm uygulama verileri (mealler, tercihler, sabitlenen ayetler, önbelleğe alınan namaz vakitleri) cihazınızda yerel olarak saklanır.</li>
    <li>Önbelleğe alınan namaz vakti yanıtları, kaydedilen konumu silerek veya uygulamanın verilerini temizleyerek silinebilir.</li>
    <li>Kuran Fihristi'ni kaldırmak, yerel olarak saklanan tüm verileri kaldırır.</li>
    <li>Bilgilerinizi korumak için Android'in güvenlik özelliklerine, (mevcut olduğunda) şifreli depolamaya ve kapsamlı depolamaya güveniriz.</li>
  </ul>

  <h2>6. Seçimleriniz</h2>
  <ul>
    <li>İzinleri (Konum ve bazı Android sürümlerinde Dosyalar ve Medya) Android Ayarlar &gt; Uygulamalar &gt; Kuran Fihristi &gt; İzinler bölümünden etkinleştirebilir veya devre dışı bırakabilirsiniz.</li>
    <li>GPS kullanmak yerine şehirleri elle arayabilirsiniz.</li>
    <li>Sabitlenen ayetleri, ayet hatırlatmalarını, önbelleğe alınan namaz vakitlerini ve paylaşılan görselleri uygulama içinde veya uygulama verilerini temizleyerek istediğiniz zaman silebilirsiniz.</li>
  </ul>

  <h2>7. Çocukların Gizliliği</h2>
  <p>Kuran Fihristi genel kitleye uygundur ve aileler tarafından kullanılabilir. Çocuklardan bilerek kişisel veri toplamayız. Bir çocuğun bize kişisel veri sağladığını düşünüyorsanız, silebilmemiz için lütfen bizimle iletişime geçin.</p>

  <h2>8. Bu Politikadaki Değişiklikler</h2>
  <p>Bu Gizlilik Politikasını zaman zaman güncelleyebiliriz. Güncellediğimizde, yukarıdaki yürürlük tarihini düzeltir ve güncellenmiş politikayı uygulamada ve web sitemizde veya mağaza girişinde erişilebilir hale getiririz. Bir değişiklikten sonra uygulamayı kullanmaya devam etmeniz, güncellenmiş politikayı kabul ettiğiniz anlamına gelir.</p>

  <h2>9. İletişim</h2>
  <p>Bu Gizlilik Politikası veya Kuran Fihristi hakkında sorularınız veya endişeleriniz varsa lütfen bize <a href="mailto:${email}">${email}</a> adresinden e-posta gönderin.</p>
</body>
</html>`;

  const en = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kuran Fihristi Privacy Policy</title>
<style>${styles}</style>
</head>
<body>
  <div class="langSwitch"><strong>English</strong> | <a href="?lang=tr">Türkçe</a></div>
  <h1>Privacy Policy</h1>
  <p>Effective date: November 1, 2025</p>
  <p>Kuran Fihristi ("we", "us", or "our") is an offline-first Quran reference application built with Jetpack Compose. This Privacy Policy explains how we handle information when you use the app. By installing or using Kuran Fihristi you agree to the practices described here.</p>

  <h2>1. Overview</h2>
  <p>We designed Kuran Fihristi to work without requiring you to create an account or share personal data. Most features run entirely on your device. We only request permissions that are needed to support specific functionality, and you can control those permissions at any time from your device settings.</p>

  <h2>2. Information We Collect</h2>
  <p>We do not collect or store personal identifiers, contact details, analytics, or advertising data. The app handles the following information to power core features:</p>
  <h3>Precise or Approximate Location (optional)</h3>
  <ul>
    <li>Used when you choose to locate yourself for the Qibla compass or to fetch local prayer times.</li>
    <li>Location coordinates are processed on your device and, when you request prayer times, sent to the <a href="${apiUrl}/" rel="noopener noreferrer" target="_blank">Prayer Times API</a> to calculate schedules.</li>
    <li>You can decline location access; in that case you may manually search for a city instead. When you search for a city, the text you type is sent to the same Prayer Times API to return matching locations.</li>
  </ul>
  <h3>Saved Places and Preferences</h3>
  <ul>
    <li>If you save a preferred city, calculation method, text size, dark mode, or verse reminders, the app stores that information locally using Android SharedPreferences.</li>
    <li>You can clear these settings by uninstalling the app or by using your device settings to clear the app’s data.</li>
  </ul>
  <h3>Offline Quran Database and Verse Management</h3>
  <ul>
    <li>The Quran text, dictionary entries, and topic indexes ship with the app and stay on your device.</li>
    <li>Pinned verses, bookmarks, and other notes are saved locally using an on-device Room database and are not transmitted.</li>
  </ul>
  <h3>Images You Create</h3>
  <ul>
    <li>When you share or download an image of verses, the bitmap is generated on your device and saved either to a temporary cache folder or, if you choose to download, to your Pictures directory.</li>
    <li>You can remove shared images by deleting them from your gallery or by clearing the app’s cached data.</li>
  </ul>
  <h3>Device Sensors</h3>
  <ul>
    <li>The Qibla compass reads accelerometer and magnetometer data to calculate bearing. These readings are processed in real time and never stored or sent elsewhere.</li>
  </ul>

  <h2>3. How We Use Information</h2>
  <p>We use the information listed above solely to provide, maintain, and improve core functionality, including:</p>
  <ul>
    <li>Calculating the Qibla direction relative to your current heading.</li>
    <li>Showing accurate prayer times for your chosen location.</li>
    <li>Remembering your preferred translations, themes, font sizes, and reminders.</li>
    <li>Enabling you to pin, bookmark, copy, or share verses for personal study.</li>
  </ul>

  <h2>4. Data Sharing and Third Parties</h2>
  <ul>
    <li><strong>Prayer Times API:</strong> When you request prayer schedules we call the third-party service hosted at <code>${apiUrl}</code>. The request includes the location (latitude/longitude or city) you selected, the date range, timezone offset, and chosen calculation method. No other personal data is transmitted.</li>
    <li><strong>Google Play Services:</strong> The app uses Google Play Services Location APIs to access GPS/Wi-Fi signals. Location data handled by Google is subject to Google’s own privacy terms.</li>
    <li><strong>System Sharing:</strong> If you share content (e.g., verse images) we hand the file or text to Android’s share sheet. Any further distribution depends on the target apps you choose.</li>
    <li>We do not use advertising networks, analytics providers, crash reporters, or social logins.</li>
  </ul>

  <h2>5. Data Storage, Retention, and Security</h2>
  <ul>
    <li>All app data (translations, preferences, pinned verses, cached prayer times) is stored locally on your device.</li>
    <li>Cached prayer time responses can be cleared by deleting the saved location or by clearing the app’s data.</li>
    <li>Uninstalling Kuran Fihristi removes all locally stored data.</li>
    <li>We rely on Android’s security features, encrypted storage (where available), and scoped storage to protect your information.</li>
  </ul>

  <h2>6. Your Choices</h2>
  <ul>
    <li>You can enable or disable permissions (Location, and on some Android versions Files &amp; Media) from Android Settings &gt; Apps &gt; Kuran Fihristi &gt; Permissions.</li>
    <li>You may search for cities manually instead of using GPS.</li>
    <li>You can delete pinned verses, verse reminders, cached prayer times, and shared images at any time within the app or by clearing app data.</li>
  </ul>

  <h2>7. Children’s Privacy</h2>
  <p>Kuran Fihristi is suitable for general audiences and can be used by families. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us so we can delete it.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. When we do, we will revise the effective date above and make the updated policy available in the app and on our website or store listing. Continued use of the app after a change means you accept the updated policy.</p>

  <h2>9. Contact</h2>
  <p>If you have questions or concerns about this Privacy Policy or Kuran Fihristi, please email us at <a href="mailto:${email}">${email}</a>.</p>
</body>
</html>`;

  return c.html(lang === "en" ? en : tr);
}

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`); // Listening on http://localhost:3000
});

export default app;
