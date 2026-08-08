<script lang="ts">
  import { redirect } from '@sveltejs/kit';

  // Default redirect to login
  redirect(307, '/login');
</script>
