export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonOptions {
  id: string;
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = options.id;
  button.textContent = options.label;
  button.className = `toolbar-button toolbar-button-${options.variant ?? 'secondary'}`;
  button.addEventListener('click', options.onClick);
  return button;
}
