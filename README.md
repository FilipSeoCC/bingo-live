# Bingo live

Bingo 5x5 ze wspólnym skreślaniem na żywo. Każdy pokój (`?r=kod`) ma własną planszę, a skreślenia widzą wszyscy w pokoju w czasie rzeczywistym. Hasła edytuje się w aplikacji (✏️ Edytuj hasła).

## Stack
- `public/index.html`: cały frontend, bez bundlera
- Firebase Hosting + Firestore (realtime), bez własnego backendu
- `firestore.rules`: reguły dostępu

## Wdrożenie
1. W konsoli Firebase utwórz projekt i bazę Firestore, a potem dodaj aplikację internetową.
2. Wklej konfigurację do `public/firebase-config.js`.
3. `npx firebase-tools login`
4. `npx firebase-tools deploy --project <ID_PROJEKTU>`
