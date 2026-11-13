<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker: () =>
    new Worker(new URL('../workers/editor.worker.js', import.meta.url), {
      type: 'module',
    }),
};

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'python' },
});
const emit = defineEmits(['update:modelValue']);

const el = ref(null);
let editor;
let completionProvider;

monaco.editor.defineTheme('codearena', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'F38071' },
    { token: 'string', foreground: 'F5B95B' },
    { token: 'number', foreground: 'F69495' },
    { token: 'comment', foreground: '76CDCD', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#2C363F',
    'editorCursor.foreground': '#2CCED2',
    'editor.lineHighlightBackground': '#ffffff10',
  },
});

onMounted(() => {
  editor = monaco.editor.create(el.value, {
    value: props.modelValue,
    language: props.language,
    theme: 'codearena',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
  });

  if (props.language === 'python') {
    completionProvider = monaco.languages.registerCompletionItemProvider(
      'python',
      {
        triggerCharacters: ['.'],
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const kind = monaco.languages.CompletionItemKind.Method;
          const beforeWord = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: word.startColumn,
          });
          const afterDot = beforeWord.endsWith('.');

          const methods = [
            {
              label: 'nearest_enemy',
              kind,
              detail: 'Trouver l’ennemi le plus proche',
              insertText: 'nearest_enemy()',
              range,
            },
            {
              label: 'attack',
              kind,
              detail: 'Attaquer une cible',
              insertText: 'attack(${1:target})',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
            {
              label: 'move_towards',
              kind,
              detail: 'Se déplacer vers une cible',
              insertText: 'move_towards(${1:target})',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
            {
              label: 'distance_to',
              kind,
              detail: 'Calculer la distance vers une cible',
              insertText: 'distance_to(${1:target})',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
          ];
          const snippets = [
            {
              label: 'on_tick',
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: 'Créer la boucle de décision du bot',
              insertText: [
                'def on_tick(game):',
                '\t${1:enemy = game.nearest_enemy()}',
                '\t${0:pass}',
              ].join('\n'),
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
          ];

          return { suggestions: afterDot ? methods : snippets };
        },
      }
    );
  }

  editor.onDidChangeModelContent(() =>
    emit('update:modelValue', editor.getValue())
  );
});

watch(
  () => props.modelValue,
  (v) => {
    if (editor && v !== editor.getValue()) editor.setValue(v);
  }
);

onBeforeUnmount(() => {
  completionProvider?.dispose();
  editor?.dispose();
});
</script>

<template>
  <div ref="el" class="h-full w-full" />
</template>
