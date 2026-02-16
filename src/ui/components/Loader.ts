export interface LoaderController {
  show(message?: string): void;
  hide(): void;
}

export function createLoader(parent: HTMLElement): LoaderController {
  const wrapper = document.createElement('div');
  wrapper.className = 'loader hidden';
  wrapper.innerHTML = `
    <div class="loader-spinner" aria-hidden="true"></div>
    <p class="loader-message">Loading...</p>
  `;
  parent.appendChild(wrapper);

  const messageElement = wrapper.querySelector('.loader-message');
  if (!messageElement) {
    throw new Error('Loader UI initialization failed.');
  }

  return {
    show(message?: string): void {
      messageElement.textContent = message ?? 'Loading...';
      wrapper.classList.remove('hidden');
    },
    hide(): void {
      wrapper.classList.add('hidden');
    },
  };
}
