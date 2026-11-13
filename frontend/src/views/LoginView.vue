<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = useRouter();
const route = useRoute();
const { login } = useAuth();

const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

async function handleLogin() {
  errorMessage.value = '';
  successMessage.value = '';

  if (!identifier.value.trim() || !password.value) {
    errorMessage.value =
      'Veuillez renseigner votre identifiant et mot de passe.';
    return;
  }

  isLoading.value = true;
  try {
    await login(identifier.value.trim(), password.value);
    successMessage.value = 'Connexion réussie ! Redirection...';

    const target = route.query.redirect || '/arena';
    setTimeout(() => {
      router.push(target);
    }, 800);
  } catch (err) {
    errorMessage.value = err.message || 'Impossible de joindre le serveur.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
  >
    <div
      class="max-w-md w-full space-y-8 bg-arena-deep/80 backdrop-blur border border-arena-soft/20 p-8 rounded-2xl shadow-2xl"
    >
      <!-- Header -->
      <div class="text-center space-y-2">
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-arena-primary/10 border border-arena-primary/30 text-arena-primary font-extrabold text-2xl shadow-inner mb-2"
        >
          &gt;_
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-white">
          Connexion &agrave; CodeArena
        </h2>
        <p class="text-sm text-arena-soft/80">
          Entrez vos identifiants pour acc&eacute;der &agrave; votre poste de
          pilotage
        </p>
      </div>

      <!-- Feedback Alerts -->
      <div
        v-if="errorMessage"
        id="login-error-alert"
        class="p-3.5 rounded-lg bg-arena-coral/10 border border-arena-coral/30 text-arena-pink text-sm flex items-center gap-2"
      >
        <span class="font-bold">&#9888;</span>
        <span>{{ errorMessage }}</span>
      </div>

      <div
        v-if="successMessage"
        id="login-success-alert"
        class="p-3.5 rounded-lg bg-arena-primary/10 border border-arena-primary/30 text-arena-soft text-sm flex items-center gap-2"
      >
        <span class="font-bold">&#10004;</span>
        <span>{{ successMessage }}</span>
      </div>

      <!-- Form -->
      <form class="space-y-5" @submit.prevent="handleLogin">
        <div>
          <label
            for="identifier"
            class="block text-xs font-semibold uppercase tracking-wider text-arena-soft mb-1.5"
          >
            Nom d'utilisateur ou Email
          </label>
          <input
            id="identifier"
            v-model="identifier"
            type="text"
            required
            placeholder="testplayer ou pilote@codearena.io"
            class="w-full px-4 py-2.5 rounded-lg bg-arena-bg border border-arena-soft/20 focus:border-arena-primary focus:ring-1 focus:ring-arena-primary text-white placeholder-arena-soft/50 text-sm outline-none transition-all"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              for="password"
              class="block text-xs font-semibold uppercase tracking-wider text-arena-soft"
            >
              Mot de passe
            </label>
          </div>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            class="w-full px-4 py-2.5 rounded-lg bg-arena-bg border border-arena-soft/20 focus:border-arena-primary focus:ring-1 focus:ring-arena-primary text-white placeholder-arena-soft/50 text-sm outline-none transition-all"
          />
        </div>

        <button
          id="btn-login-submit"
          type="submit"
          :disabled="isLoading"
          class="w-full py-3 px-4 rounded-lg font-semibold text-arena-bg bg-gradient-to-r from-arena-primary to-arena-soft hover:from-arena-soft hover:to-arena-primary disabled:opacity-50 transition-all shadow-lg shadow-arena-primary/20"
        >
          {{ isLoading ? 'Connexion en cours...' : 'Se connecter' }}
        </button>
      </form>

      <!-- Footer Link -->
      <div
        class="text-center text-sm text-arena-soft/80 pt-2 border-t border-arena-soft/20"
      >
        Pas encore de compte ?
        <RouterLink
          to="/register"
          class="text-arena-primary hover:text-arena-soft font-semibold underline underline-offset-4 ml-1"
        >
          S'inscrire
        </RouterLink>
      </div>
    </div>
  </div>
</template>
