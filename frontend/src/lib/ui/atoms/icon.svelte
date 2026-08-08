<script lang="ts">
  interface Props {
    name: string;
    size?: string;
    class?: string;
  }

  let { name, size = '1.25rem', class: cls = '' }: Props = $props();
</script>

<span
  class="material-symbols-outlined select-none {cls}"
  style="font-size: {size};"
  aria-hidden="true"
>
  {name}
</span>
