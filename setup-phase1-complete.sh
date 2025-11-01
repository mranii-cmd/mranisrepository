#!/bin/bash
# setup-phase1-complete.sh

cd edt-refonte

# Créer tous les dossiers
mkdir -p src/{models,core,services,ui/{components,views},utils,styles/components,legacy}
mkdir -p {docs,tests/{models,services,utils}}

# CSS Files
cat > src/styles/reset.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html { font-size: 16px; }
button { cursor: pointer; border: none; background: none; font-family: inherit; }
input, select, textarea { font-family: inherit; font-size: inherit; }
a { text-decoration: none; color: inherit; }
EOF

cat > src/styles/main.css << 'EOF'
@import './reset.css';
@import './variables.css';

body {
  font-family: var(--font-family);
  color: var(--color-text);
  background-color: var(--color-bg);
}
#app { min-height: 100vh; }
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 1.2rem;
  color: var(--color-primary);
}
EOF

cat > src/main.js << 'EOF'
console.log('🚀 EDT v3.0 - Initialisation...');
function init() {
  console.log('✅ Application EDT chargée');
  document.getElementById('app').innerHTML = `
    <div style="text-align: center; padding: 50px; font-family: sans-serif;">
      <h1>🏗️ EDT v3.0 - En Construction</h1>
      <p>Structure modulaire mise en place avec succès !</p>
    </div>
  `;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
EOF

# Component CSS (placeholders)
echo "/* Form styles - À implémenter */" > src/styles/components/form.css
echo "/* Table styles - À implémenter */" > src/styles/components/table.css
echo "/* Modal styles - À implémenter */" > src/styles/components/modal.css
echo "/* Tabs styles - À implémenter */" > src/styles/components/tabs.css
echo "/* Buttons styles - À implémenter */" > src/styles/components/buttons.css

# Barrel exports
echo "console.log('Models module - à implémenter');" > src/models/index.js
echo "console.log('Core module - à implémenter');" > src/core/index.js
echo "console.log('Services module - à implémenter');" > src/services/index.js
echo "console.log('UI module - à implémenter');" > src/ui/index.js
echo "console.log('UI Components - à implémenter');" > src/ui/components/index.js
echo "console.log('UI Views - à implémenter');" > src/ui/views/index.js
echo "console.log('Utils module - à implémenter');" > src/utils/index.js

# Documentation
cat > README.md << 'EOF'
# 📚 EDT v3.0 - Gestion Emploi du Temps

**Version** : 3.0.0 (Phase 1)
**Auteur** : Pr. Ibrahim Mrani - UCD

## Structure