/**
 * Point d'entrée principal de l'application EDT
 * @module main
 */
console.log('🚀 EDT v3.0 - Initialisation...');

function init() {
  console.log('✅ Application EDT chargée');
  document.getElementById('app').innerHTML = `
    <div style="text-align: center; padding: 50px; font-family: sans-serif;">
      <h1>🏗️ EDT v3.0 - En Construction</h1>
      <p>Structure modulaire mise en place avec succès !</p>
      <p style="color: #666; margin-top: 20px;">
        Prochaine étape : Configuration des modèles et du state management
      </p>
    </div>
  `;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}