# Animations des tenues de campagne

Les six tenues supplémentaires possèdent chacune trois planches transparentes de 16 poses : combat, déplacements et réactions, interactions et KO. Les trois tenues de base conservent leurs planches existantes. Les neuf styles de campagne disposent ainsi du même ensemble d'actions, avec des vêtements propres à chaque style.

| Candidat | Nouvelles tenues |
| --- | --- |
| Mélenchon | Populiste, Communautariste |
| Marine Le Pen | Libérale · Parti de gouvernement, Zemmouriste |
| Édouard Philippe | Européiste, Notable local |

Les fichiers PNG sont dans `assets/generated/animations/skins/`, nommés `<candidat>-<style>-combat-v1.png`, `-movement-v1.png` et `-actions-v1.png`. Ils ont été créés avec **ImageGen intégré**, à partir des planches de poses et du sprite original de chaque tenue. Les prompts exacts et les références figurent dans [skin-animation-prompts.json](skin-animation-prompts.json).

La sélection s'effectue à partir de `current_campaign_style`, sans modifier les règles ni les durées de combat. Les costumes temporaires d'ultime (Bardella, gilet jaune, Super Européiste) restent gérés séparément. Les sprites de repos originaux sont conservés.

Les rectangles et points d'appui se trouvent dans `src/presentation/skin-animation-data.js`. Une échelle commune à chaque planche maintient les proportions anatomiques : une pose accroupie ne grandit pas artificiellement. Le script Python de mesure lit uniquement les PNG ; il ne retouche pas les images.

Pour comparer : ouvrir `src/presentation/combat-preview.html`, `melenchon-actions-preview.html` ou `melenchon-guard-preview.html`, choisir le candidat puis sa tenue. Le paramètre `skin` conserve la sélection entre les aperçus liés.

Vérifications effectuées : les 18 planches comptent chacune 16 silhouettes RGBA ; les aperçus du combat, des interactions et de la marche avec arrêt passent pour les six nouvelles tenues. La suite complète compte 225 tests réussis. L'export web a été généré avec les nouveaux fichiers.
