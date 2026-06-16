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

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`); // Listening on http://localhost:3000
});

export default app;
