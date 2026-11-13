<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth.js';

const router = useRouter();
const { currentUser, logout } = useAuth();

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-arena-bg text-slate-100 selection:bg-arena-primary selection:text-arena-bg"
  >
    <!-- Navigation Header -->
    <header
      class="sticky top-0 z-50 backdrop-blur-md bg-arena-bg/90 border-b border-arena-soft/20"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo & Brand -->
          <div class="flex items-center gap-8">
            <RouterLink to="/" class="flex items-center gap-3 group">
              <div
                class="w-9 h-9 rounded-lg bg-gradient-to-tr from-arena-coral to-arena-primary flex items-center justify-center font-black text-arena-bg text-lg shadow-lg shadow-arena-primary/20 group-hover:scale-105 transition-transform"
              >
                CA
              </div>
              <div class="flex flex-col">
                <span class="font-extrabold text-lg tracking-wider text-white"
                  >CODE<span class="text-arena-primary">ARENA</span></span
                >
                <span
                  class="text-[10px] uppercase font-mono tracking-widest text-arena-soft -mt-1"
                  >Tactical 2D</span
                >
              </div>
            </RouterLink>

            <!-- Nav Links -->
            <nav class="hidden md:flex items-center gap-1">
              <RouterLink
                to="/"
                class="px-3.5 py-2 rounded-lg text-sm font-medium text-arena-soft hover:text-white hover:bg-arena-deep transition-colors"
                active-class="text-arena-primary bg-arena-deep/90 font-semibold"
              >
                Accueil
              </RouterLink>
              <RouterLink
                to="/arena"
                class="px-3.5 py-2 rounded-lg text-sm font-medium text-arena-soft hover:text-white hover:bg-arena-deep transition-colors"
                active-class="text-arena-primary bg-arena-deep/90 font-semibold"
              >
                Ar&egrave;ne
              </RouterLink>
            </nav>
          </div>

          <!-- Auth Actions -->
          <div class="flex items-center gap-3">
            <template v-if="currentUser">
              <span
                class="text-sm font-medium text-arena-soft hidden sm:inline"
              >
                Pilote :
                <span class="text-arena-primary font-semibold">{{
                  currentUser.username
                }}</span>
              </span>
              <button
                @click="handleLogout"
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-arena-deep hover:bg-arena-coral/20 text-arena-soft hover:text-arena-pink border border-arena-soft/20 hover:border-arena-coral/50 transition-all"
              >
                D&eacute;connexion
              </button>
            </template>
            <template v-else>
              <RouterLink
                to="/login"
                id="nav-login"
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-arena-soft hover:text-white hover:bg-arena-deep border border-transparent hover:border-arena-soft/20 transition-all"
              >
                Connexion
              </RouterLink>
              <RouterLink
                to="/register"
                id="nav-register"
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-arena-bg bg-gradient-to-r from-arena-primary to-arena-soft hover:from-arena-soft hover:to-arena-primary shadow-md shadow-arena-primary/20 transition-all"
              >
                Inscription
              </RouterLink>
            </template>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer
      class="border-t border-arena-deep bg-arena-deep/60 py-6 text-xs text-arena-soft/70 text-center"
    >
      <div
        class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div>
          &copy; 2026 CodeArena &bull; SA&Eacute; BUT3 Informatique &bull; Tous
          droits r&eacute;serv&eacute;s
        </div>
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1.5 text-arena-soft">
            <span class="w-2 h-2 rounded-full bg-arena-amber"></span>
            PostgreSQL: Pr&ecirc;t
          </span>
          <span class="flex items-center gap-1.5 text-arena-soft">
            <span class="w-2 h-2 rounded-full bg-arena-primary"></span>
            Docker Sandbox: S&eacute;curis&eacute;e
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>
