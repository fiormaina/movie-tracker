(() => {
  function pluralizeRu(count, forms) {
    const safeCount = Math.abs(Number(count) || 0);
    const lastDigit = safeCount % 10;
    const lastTwoDigits = safeCount % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return forms.many;
    if (lastDigit === 1) return forms.one;
    if (lastDigit >= 2 && lastDigit <= 4) return forms.few;
    return forms.many;
  }

  function createToastController(setState, selectToasts = (state) => state.toasts) {
    let toastId = 0;

    return function showToast(message, type = "success", duration = 3200) {
      const id = `toast-${++toastId}`;

      setState((currentState) => ({
        ...currentState,
        toasts: [...selectToasts(currentState), { id, message, type }],
      }));

      window.setTimeout(() => {
        setState((currentState) => ({
          ...currentState,
          toasts: selectToasts(currentState).filter((toast) => toast.id !== id),
        }));
      }, duration);
    };
  }

  window.MovieTrackerHelpers = {
    createToastController,
    pluralizeRu,
  };
})();
