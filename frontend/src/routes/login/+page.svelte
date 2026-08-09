<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { signIn } from '$lib/auth-client.js';
  import { toast } from '$lib/ui/molecules/toast-store.svelte.js';
  import { BrandHeader, Button, Icon } from '$lib/ui/index.js';

  let username = $state('');
  let password = $state('');
  let loading = $state(false);
  let showPassword = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    try {
      await signIn(username, password);
      toast.success(`Selamat datang, ${username}`);
      await goto(resolve('/dashboard'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login gagal');
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Login — uangkost</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <div
    class="pointer-events-none fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3"
  ></div>
  <div
    class="pointer-events-none fixed top-20 left-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl"
  ></div>
  <div
    class="pointer-events-none fixed right-10 bottom-20 h-80 w-80 rounded-full bg-secondary/5 blur-3xl"
  ></div>

  <div class="animate-in relative z-10 w-full max-w-md card-surface p-6 card-glow sm:p-8">
    <BrandHeader size="lg" />

    <form onsubmit={handleSubmit} class="space-y-5">
      <div>
        <label for="login-username" class="mb-1.5 block label-md text-text-secondary"
          >Username</label
        >
        <div class="relative">
          <Icon
            name="person"
            size="1.1rem"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-secondary"
          />
          <input
            id="login-username"
            type="text"
            placeholder="Masukkan username"
            value={username}
            oninput={(e) => (username = (e.target as HTMLInputElement).value)}
            required
            class="input-field pl-10"
            autocomplete="username"
          />
        </div>
      </div>
      <div>
        <label for="login-password" class="mb-1.5 block label-md text-text-secondary"
          >Password</label
        >
        <div class="relative">
          <Icon
            name="lock"
            size="1.1rem"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-secondary"
          />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Masukkan password"
            value={password}
            oninput={(e) => (password = (e.target as HTMLInputElement).value)}
            required
            class="input-field pr-10 pl-10"
            autocomplete="current-password"
          />
          <Button
            variant="ghost"
            iconOnly
            icon={showPassword ? 'visibility_off' : 'visibility'}
            size="sm"
            class="absolute top-1/2 right-3 -translate-y-1/2"
            aria-label="Tampilkan password"
            onclick={() => (showPassword = !showPassword)}
          />
        </div>
      </div>
      <Button
        variant="primary"
        type="submit"
        icon="login"
        disabled={loading}
        class="mt-6 w-full py-3 text-base"
      >
        {loading ? 'Memproses...' : 'Masuk'}
      </Button>
    </form>
  </div>
</div>

<style>
  .animate-in {
    animation: slideUp 0.4s ease-out;
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
