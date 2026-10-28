/* =========================================================
   Conexión con Supabase
   Supabase → Project Settings → API:
   - url:     "Project URL"
   - anonKey: clave "anon" / "publishable" (es pública, la protección
              de los datos la hacen las políticas de esquema.sql)
   Mientras estén vacías, las herramientas guardan solo en este navegador.
   ========================================================= */
window.ZE_CONFIG = {
  url: "https://kzlhjyvayrrqvviczhlo.supabase.co",
  anonKey: "sb_publishable_Y6zUE8n6KkLLqiyTs5yLEw_U48_q00d",
  // clave pública para las notificaciones (la privada solo está en Supabase)
  vapidPublic: "BHkqieB-n4dEd-dXJzPlgzA8MyYD6x1v_fHgcR64sO5QDsPFs47_cXKywshxe8BX0zIW8nYxi-UXsHlbuMai8G4"
};
