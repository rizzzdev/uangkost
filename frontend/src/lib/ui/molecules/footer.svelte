<script lang="ts">
  import Icon from '../atoms/icon.svelte';
</script>

<footer class="mt-auto border-t border-outline-variant/50 px-4 py-4 lg:px-6">
  <div
    class="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left"
  >
    <div class="flex items-center gap-2">
      <Icon name="account_balance_wallet" size="1rem" class="text-primary" />
      <span class="label-md font-medium text-text-primary">uangkost</span>
      <span class="hidden label-md text-text-secondary sm:inline"
        >· Sistem Manajemen Iuran Kost</span
      >
    </div>
    <p class="label-md text-text-secondary">© {new Date().getFullYear()} uangkost</p>
    <a
      href="https://github.com/rizzzdev"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-1.5 label-md text-text-secondary transition-colors hover:text-primary"
      title="GitHub rizzzdev"
    >
      <Icon name="code" size="0.95rem" />
      Dibuat oleh
      <span class="font-medium text-primary underline decoration-primary/40 underline-offset-2"
        >rizzz.dev</span
      >
    </a>
  </div>
</footer>
