/**
 * Script inline exécuté dès le chargement de la page : l'événement
 * « beforeinstallprompt » peut survenir avant l'hydratation de React.
 * On le met de côté pour la bannière et on empêche la mini-barre native
 * de Chrome (l'invitation n'apparaît qu'au moment choisi par Vitalya).
 */
export const INSTALL_CAPTURE_SCRIPT =
  'window.__vitalyaInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vitalyaInstallPrompt=e;window.dispatchEvent(new Event("vitalya:installable"))});'
