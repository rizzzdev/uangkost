<script lang="ts">
  interface Props {
    id?: string;
    type?: string;
    placeholder?: string;
    value?: string;
    name?: string;
    required?: boolean;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
  }

  let {
    id = '',
    type = 'text',
    placeholder = '',
    value = '',
    name = '',
    required = false,
    oninput,
    onchange
  }: Props = $props();
</script>

<input
  {id}
  {type}
  {name}
  {placeholder}
  {required}
  {value}
  class="input-field"
  {oninput}
  {onchange}
/>
