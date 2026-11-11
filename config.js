// Configuración de la app.
// Mientras SUPABASE_URL esté vacío, la app funciona en "modo demo"
// (los datos se guardan solo en el teléfono, sirve para probar).
// Para usarla con clientes reales, pega aquí los datos de tu proyecto de Supabase
// (Supabase > Project Settings > API).
window.APP_CONFIG = {
  APP_NAME: "Shoppers Miami",
  APP_URL: "https://shoppersmiami.github.io/",            // link público de la app (ej: "https://mi-shopper.netlify.app/"); se usa en los links de WhatsApp
  SUPABASE_URL: "https://rgjwuiqeohymbsfrtoyu.supabase.co",       // ej: "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnand1aXFlb2h5bWJzZnJ0b3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzcwNzIsImV4cCI6MjEwNjMxMzA3Mn0.rhHFibRyhDvPUcWa-b7Y8D0YVzN5z68zxQVhdDaHIp4"   // la clave "anon" o "publishable"
};
