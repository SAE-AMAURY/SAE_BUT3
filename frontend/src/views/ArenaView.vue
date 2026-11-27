<script setup>
import { ref, onMounted } from 'vue';
import { defineAsyncComponent } from 'vue';
const CodeEditor = defineAsyncComponent(
  () => import('../components/CodeEditor.vue')
);

const canvasRef = ref(null);
const isRunning = ref(false);
const tickRate = ref(60);
const botCode = ref(`# Script du bot Alpha-Guerrier
def on_tick(game):
    enemy = game.nearest_enemy()

    if enemy and game.distance_to(enemy) < 120:
        game.attack(enemy)
    else:
        game.move_towards(enemy)
`);

const bots = ref([
  {
    id: 1,
    name: 'Alpha-Guerrier',
    class: 'Guerrier',
    hp: 100,
    maxHp: 100,
    shield: 25,
    color: '#2CCED2',
  },
  {
    id: 2,
    name: 'Omega-Tank',
    class: 'Tank',
    hp: 150,
    maxHp: 150,
    shield: 60,
    color: '#F38071',
  },
]);

const logs = ref([
  {
    time: '00:00.000',
    text: "Initialisation de l'arène tactique CodeArena 2D...",
  },
  {
    time: '00:00.012',
    text: 'Chargement des scripts de combat dans la sandbox Docker...',
  },
  {
    time: '00:00.045',
    text: "Bots prêts au combat. En attente du coup d'envoi.",
  },
]);

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw grid & initial tactical board
  drawArena(ctx, canvas.width, canvas.height);
});

function drawArena(ctx, width, height) {
  // Clear
  ctx.fillStyle = '#2C363F';
  ctx.fillRect(0, 0, width, height);

  // Tactical Grid
  ctx.strokeStyle = '#3D4B54';
  ctx.lineWidth = 1;
  const gridSize = 40;

  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw demo bot A
  ctx.save();
  ctx.fillStyle = '#2CCED2';
  ctx.shadowColor = '#2CCED2';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(160, 200, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Direction indicator A
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(160, 200);
  ctx.lineTo(190, 200);
  ctx.stroke();

  // Draw demo bot B
  ctx.save();
  ctx.fillStyle = '#F38071';
  ctx.shadowColor = '#F38071';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(640, 200, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Direction indicator B
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(640, 200);
  ctx.lineTo(610, 200);
  ctx.stroke();
}

function toggleMatch() {
  isRunning.value = !isRunning.value;
  logs.value.unshift({
    time: new Date().toLocaleTimeString(),
    text: isRunning.value ? 'Combat démarré.' : 'Combat mis en pause.',
  });
}

function resetMatch() {
  isRunning.value = false;
  logs.value.unshift({
    time: new Date().toLocaleTimeString(),
    text: 'Arène réinitialisée aux positions initiales.',
  });
}
</script>

<template>
  <div class="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-arena-soft/20"
    >
      <div>
        <h1
          class="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3"
        >
          <span
            class="inline-block w-3 h-3 rounded-full bg-arena-primary"
          ></span>
          Ar&egrave;ne de Combat 2D
        </h1>
        <p class="text-sm text-arena-soft/80 mt-1">
          Visualisation temps r&eacute;el des affrontements algorithmiques
        </p>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-3">
        <button
          id="btn-arena-toggle"
          @click="toggleMatch"
          class="px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          :class="
            isRunning
              ? 'bg-arena-amber hover:bg-arena-amber/80 text-arena-bg'
              : 'bg-arena-primary hover:bg-arena-soft text-arena-bg'
          "
        >
          {{ isRunning ? '&#10074;&#10074; Pause' : '&#9654; D&eacute;marrer' }}
        </button>
        <button
          id="btn-arena-reset"
          @click="resetMatch"
          class="px-4 py-2 rounded-lg font-semibold text-sm bg-arena-deep hover:bg-arena-surface text-slate-200 border border-arena-soft/20 transition-all"
        >
          &#8635; R&eacute;initialiser
        </button>
      </div>
    </div>

    <!-- Arena Grid Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Canvas Area (2 cols) -->
      <div
        class="lg:col-span-2 bg-arena-deep/80 border border-arena-soft/20 rounded-xl p-4 shadow-xl flex flex-col items-center"
      >
        <canvas
          ref="canvasRef"
          width="800"
          height="450"
          id="arena-canvas"
          class="w-full max-w-full h-auto rounded-lg border border-arena-soft/20 shadow-inner bg-arena-bg"
        ></canvas>

        <div
          class="w-full flex items-center justify-between text-xs text-arena-soft/80 mt-3 px-1"
        >
          <span>Dimensions: 800 x 450 px</span>
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="
                isRunning
                  ? 'bg-arena-primary animate-pulse'
                  : 'bg-arena-soft/40'
              "
            ></span>
            {{ isRunning ? "En cours d'exécution (60 FPS)" : 'En attente' }}
          </span>
        </div>

        <!-- Monaco Editor -->
        <div
          class="w-full mt-4 rounded-lg border border-arena-soft/20 bg-arena-bg overflow-hidden shadow-inner"
        >
          <div
            class="flex items-center justify-between gap-3 px-3 py-2 border-b border-arena-soft/20 bg-arena-deep/60"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-arena-primary"></span>
              <h2 class="text-sm font-bold text-slate-200">Script de combat</h2>
            </div>
            <span
              class="text-[11px] uppercase tracking-wider text-arena-primary bg-arena-primary/10 border border-arena-primary/30 rounded px-2 py-1"
            >
              Python
            </span>
          </div>

          <div class="h-80">
            <CodeEditor v-model="botCode" language="python" />
          </div>

          <div
            class="flex items-center justify-between px-3 py-2 border-t border-arena-soft/20 bg-arena-deep/60 text-xs text-arena-soft/80"
          >
            <span>Monaco Editor</span>
            <span class="text-arena-primary">Prêt à compiler</span>
          </div>
        </div>
      </div>

      <!-- Status Panel (1 col) -->
      <div class="space-y-4">
        <!-- Bot Cards -->
        <div
          class="bg-arena-deep/80 border border-arena-soft/20 rounded-xl p-4 shadow-xl space-y-4"
        >
          <h2
            class="text-sm font-bold uppercase tracking-wider text-arena-soft/80"
          >
            Bots engag&eacute;s
          </h2>

          <div
            v-for="bot in bots"
            :key="bot.id"
            class="p-3 rounded-lg bg-arena-bg/60 border border-arena-soft/20 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span
                class="font-bold text-sm text-white"
                :style="{ color: bot.color }"
                >{{ bot.name }}</span
              >
              <span
                class="text-xs px-2 py-0.5 rounded bg-arena-surface text-arena-soft font-medium"
                >{{ bot.class }}</span
              >
            </div>

            <!-- Health Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs text-arena-soft/80">
                <span>Sant&eacute;</span>
                <span>{{ bot.hp }} / {{ bot.maxHp }}</span>
              </div>
              <div
                class="w-full bg-arena-surface h-2 rounded-full overflow-hidden"
              >
                <div
                  class="bg-arena-coral h-full rounded-full transition-all duration-300"
                  :style="{ width: `${(bot.hp / bot.maxHp) * 100}%` }"
                ></div>
              </div>
            </div>

            <!-- Shield Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs text-arena-soft/80">
                <span>Bouclier</span>
                <span>{{ bot.shield }}%</span>
              </div>
              <div
                class="w-full bg-arena-surface h-1.5 rounded-full overflow-hidden"
              >
                <div
                  class="bg-arena-primary h-full rounded-full transition-all duration-300"
                  :style="{ width: `${bot.shield}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div
          class="bg-arena-deep/80 border border-arena-soft/20 rounded-xl p-4 shadow-xl space-y-2"
        >
          <h2
            class="text-sm font-bold uppercase tracking-wider text-arena-soft/80"
          >
            Journal de combat
          </h2>
          <div
            class="bg-arena-bg rounded-lg p-3 font-mono text-xs text-arena-soft h-44 overflow-y-auto space-y-1.5 border border-arena-soft/20"
          >
            <div
              v-for="(log, idx) in logs"
              :key="idx"
              class="flex gap-2 leading-relaxed"
            >
              <span class="text-arena-primary select-none"
                >[{{ log.time }}]</span
              >
              <span>{{ log.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
