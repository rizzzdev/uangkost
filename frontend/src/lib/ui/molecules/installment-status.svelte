<script lang="ts">
  import Icon from '../atoms/icon.svelte';

  type Status = 'verified' | 'rejected' | 'pending';

  interface Props {
    status: Status;
  }

  let { status }: Props = $props();

  const meta = $derived(
    status === 'verified'
      ? { icon: 'verified', text: 'Terverifikasi', cls: 'bg-[#34D399]/20 text-[#34D399]' }
      : status === 'rejected'
        ? { icon: 'cancel', text: 'Ditolak', cls: 'bg-[#F87171]/20 text-[#F87171]' }
        : { icon: 'pending', text: 'Menunggu', cls: 'bg-[#fabd34]/20 text-[#fabd34]' }
  );
</script>

<span
  class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {meta.cls}"
  title={meta.text}
>
  <Icon name={meta.icon} size="0.9rem" />
  <!-- Di mode mobile tampilkan ikon saja, teks muncul di layar lebih besar -->
  <span class="hidden sm:inline">{meta.text}</span>
</span>
