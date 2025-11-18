import { useEffect } from 'react';

const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 检查是否在输入框中
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        document.activeElement?.tagName
      );

      // 如果在输入框中，只处理特定的快捷键
      if (isInputFocused && !event.ctrlKey && !event.metaKey) {
        return;
      }

      for (const shortcut of shortcuts) {
        const {
          key,
          ctrlKey = false,
          metaKey = false,
          shiftKey = false,
          altKey = false,
          callback,
          preventDefault = true
        } = shortcut;

        // 检查按键组合是否匹配
        const keyMatches = event.key.toLowerCase() === key.toLowerCase();
        const ctrlMatches = event.ctrlKey === ctrlKey;
        const metaMatches = event.metaKey === metaKey;
        const shiftMatches = event.shiftKey === shiftKey;
        const altMatches = event.altKey === altKey;

        if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
          if (preventDefault) {
            event.preventDefault();
          }
          callback(event);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

export default useKeyboardShortcuts;

