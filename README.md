# S-Trainer app — Plataforma Full-Stack de Entrenamiento

> **MÉTODO DE ENTRENAMIENTO: Planificación · Adherencia · Progresión**

S-Trainer app es una solución integral para entrenadores personales y sus clientes, compuesta por:
1. **App Móvil del Cliente (390×844px):** Interfaz optimizada para uso con una mano en sala de pesas, registro de series con RIR (Reps In Reserve), cuenta atrás de descanso interactiva, control nutricional con lista de compra reactiva y seguimiento opcional y privado de ciclo menstrual.
2. **Panel Web del Entrenador (1280px):** Dashboard centralizado con ficha de cliente, apartado fijo de patologías y limitaciones, comparativa *Programado vs. Realizado*, editor de programas con cálculo de volumen y semanas de descarga automáticas (S4 y S8), planificador nutricional y asistente de análisis con IA.

---

## 🎨 Identidad de Marca y Sistema de Diseño

- **Fondo primario:** `#101012`
- **Fondo de tarjetas y componentes:** `#1B1B1F`, `#232328`, `#16161A`
- **Bordes y divisores:** `#2A2A2F`, `#3A3A40`
- **Texto primario:** `#F5F4F0`
- **Texto secundario / atenuado:** `#8E8E94`, `#5C5C62`
- **Acento principal de marca:** `#CFFF5C` (Verde lima con soporte dinámico para `#FF6B4A`, `#5CD6FF`, `#FFD34D`)
- **Codificación de color por tipo de dato:**
  - **Pasos:** `#FF6B4A` (Naranja / Rojo)
  - **Peso y Medidas:** `#5CD6FF` (Azul Cian)
  - **Sueño:** `#B388FF` (Púrpura)
  - **Fuerza / Progreso:** `#CFFF5C` (Verde Lima)
  - **Nutrición:** `#CFFF5C` (Verde Lima)
  - **Ciclo Menstrual:** `#E8A0C4` (Rosa)
- **Tipografías:**
  - Display / Títulos: *Bricolage Grotesque* (800)
  - Cuerpo / Textos: *Manrope* (400–800)

---

## 🚀 Inicio Rápido (Desarrollo Local)

### Requisitos Previos
- Node.js >= 18.x
- npm >= 9.x o pnpm / yarn / bun

### Instalación
```bash
# 1. Clonar el repositorio
git clone https://github.com/luisroa1/s-trainer-app.git
cd s-trainer-app

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Compilación para Producción
```bash
npm run build
```

---

## 📦 Repositorio Vinculado en GitHub

- **Usuario:** `luisroa1`
- **Repositorio:** `s-trainer-app`
- **URL Remota:** `https://github.com/luisroa1/s-trainer-app.git`

Para sincronizar o subir cambios desde tu terminal local:

```bash
# Comprobar estado del repositorio
git status

# Empujar el código a la rama principal (main):
git push -u origin main
```

Si necesitas autenticarte por HTTPS mediante un Personal Access Token (PAT) de GitHub:
```bash
git remote set-url origin https://<TU_PERSONAL_ACCESS_TOKEN>@github.com/luisroa1/s-trainer-app.git
git push -u origin main
```

---

## 📂 Estructura del Código

```text
├── index.html                  # Entry point con fuentes Google Fonts y meta tags
├── metadata.json               # Configuración de AI Studio
├── package.json                # Dependencias y scripts
├── vite.config.ts              # Configuración de Vite con Tailwind CSS
├── src/
│   ├── main.tsx                # Bootstrap de React
│   ├── index.css               # Tema oscuro y variables CSS
│   ├── App.tsx                 # Shell principal con switch Cliente/Entrenador/Docs
│   ├── types/
│   │   └── index.ts            # Tipos e interfaces TypeScript
│   ├── data/
│   │   └── mockData.ts         # Datos iniciales (Juan, Lucía, María, Programas)
│   ├── context/
│   │   └── AppContext.tsx      # Estado reactivo global sincronizado
│   └── components/
│       ├── common/
│       │   └── RoafitLogo.tsx  # Logotipo y branding dinámico
│       ├── client/             # App Móvil Cliente
│       │   ├── ClientApp.tsx
│       │   ├── ClientHome.tsx
│       │   ├── WorkoutExercise.tsx
│       │   ├── WorkoutRest.tsx
│       │   ├── ClientProgress.tsx
│       │   ├── ClientMeasurements.tsx
│       │   ├── ClientNutrition.tsx
│       │   ├── ClientCalculator.tsx
│       │   ├── ClientShoppingList.tsx
│       │   ├── ClientSupplements.tsx
│       │   ├── ClientCycle.tsx
│       │   ├── ClientProfile.tsx
│       │   ├── ClientDataForm.tsx
│       │   ├── ClientReminders.tsx
│       │   └── ClientHelp.tsx
│       ├── trainer/            # Panel Web Entrenador
│       │   ├── TrainerApp.tsx
│       │   ├── TrainerDashboard.tsx
│       │   ├── TrainerClientDetail.tsx
│       │   ├── TrainerPrograms.tsx
│       │   ├── TrainerProgramNew.tsx
│       │   ├── TrainerProgramBuilder.tsx
│       │   ├── TrainerNutritionNew.tsx
│       │   ├── TrainerNutritionBuilder.tsx
│       │   ├── TrainerInvite.tsx
│       │   ├── TrainerExport.tsx
│       │   ├── TrainerAssistant.tsx
│       │   └── TrainerGuide.tsx
│       └── spec/
│           ├── TechSpecView.tsx # Arquitectura, Esquemas BD y Contratos API
│           └── GitHubSyncModal.tsx # Asistente de sincronización con luisroa1/s-trainer-app
```

---

## 🛡️ Seguridad y Privacidad

- **Ciclo Menstrual:** Solo se expone la fase fisiológica general (`Fase menstrual`, `Fase lútea`), sin almacenar ni transferir fechas específicas al entrenador.
- **Racha Protegida:** Ventana de recuperación de 7 días ante imprevistos para evitar el abandono por frustración.

---

## 📄 Licencia
Este proyecto es propiedad de **S-Trainer app**. Todos los derechos reservados.
