# ─────────────────────────────────────────────
# Stage 1: Dependencies (keshlash uchun ajratilgan)
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Faqat package fayllarni nusxalaymiz — bu qatlam o'zgarmasa, keshlash ishlaydi
COPY package.json package-lock.json ./

# Production kutubxonalarni o'rnatamiz (devDependencies kerak emas)
RUN npm ci --omit=dev

# ─────────────────────────────────────────────
# Stage 2: Runner (yakuniy, yengil obraz)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# Xavfsizlik: root bo'lmagan foydalanuvchi yaratamiz
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Faqat kerakli node_modules nusxalaymiz (deps stage'dan)
COPY --from=deps /app/node_modules ./node_modules

# Manba kodlarini nusxalaymiz (.dockerignore buni filtrlaydi)
COPY . .

# Port 8080 ochiladi (PORT=8080 dan mos)
EXPOSE 8080

# Non-root foydalanuvchiga o'tamiz
USER appuser

# Ishga tushirish buyrug'i
CMD ["node", "index.js"]
