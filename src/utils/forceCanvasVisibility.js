/**
 * Utility function primarily for debugging rendering issues. It attempts to force
 * all managed canvas elements to be visible by directly manipulating their styles
 * and triggering a redraw. It then checks a center pixel on each canvas to determine
 * if it likely has content rendered and logs the state.
 *
 * Note: This manipulates styles directly and performs synchronous checks,
 * which might not reflect the final state after asynchronous operations or CSS transitions.
 * Use primarily for diagnosing situations where canvases might be unexpectedly hidden or empty.
 *
 * @param {Object.<string, import('./CanvasManager').default>} managers - An object mapping layer IDs to their corresponding CanvasManager instances.
 * @returns {boolean} - True if all checked canvases appear to have content, false otherwise.
 */
export function forceCanvasVisibility(managers) {
  if (!managers || typeof managers !== 'object') {
    console.warn("[forceCanvasVisibility] No managers provided."); // Keep warning
    return false;
  }

  const managerEntries = Object.entries(managers);
  if (managerEntries.length === 0) {
    console.warn("[forceCanvasVisibility] Empty managers object."); // Keep warning
    return false;
  }

  let allHaveContent = true;

  managerEntries.forEach(([layerId, manager]) => {
    if (!manager) {
      console.warn(`[forceCanvasVisibility] Missing manager for layer ${layerId}`); // Keep warning
      allHaveContent = false;
      return;
    }

    const canvas = manager.canvas;
    if (!canvas) {
      console.warn(`[forceCanvasVisibility] Missing canvas for layer ${layerId}`); // Keep warning
      allHaveContent = false;
      return;
    }

    // Apply styles directly to attempt making canvas visible
    if (canvas.style) {
      canvas.style.opacity = "1";
      canvas.style.display = "block";
      canvas.style.visibility = "visible";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.classList.remove('hidden');
      canvas.classList.add('visible');

      // Also style parent if possible
      if (canvas.parentElement) {
        canvas.parentElement.style.position = "relative";
        canvas.parentElement.style.width = "100%";
        canvas.parentElement.style.height = "100%";
        canvas.parentElement.style.overflow = "visible";
      }
    }

    // Trigger a redraw and check content
    if (manager.image && manager.image.complete && manager.draw) {
      // Use drawStaticFrame if available for better consistency, otherwise fallback to draw
      const drawFn = manager.drawStaticFrame || manager.draw;
      drawFn.call(manager, manager.currentConfig || {}); // Call with manager context

      try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          if (width > 0 && height > 0) {
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            const imageData = ctx.getImageData(centerX, centerY, 1, 1).data;
            const hasContent = !(imageData[0] === 0 && imageData[1] === 0 && imageData[2] === 0 && imageData[3] === 0);

            // Keep the detailed log for debugging canvas state
            console.log(`[forceCanvasVisibility] Layer ${layerId}: Size: ${width}x${height}, CenterPixel: [${imageData.join(',')}], HasContent: ${hasContent}`);

            if (!hasContent) {
              allHaveContent = false;
              // Fallback draw attempt was removed for brevity, main log captures lack of content.
            }
          } else {
            console.warn(`[forceCanvasVisibility] Layer ${layerId} has zero dimensions: ${width}x${height}`); // Keep warning
            allHaveContent = false;
          }
        } else {
           console.warn(`[forceCanvasVisibility] Could not get 2D context for layer ${layerId}`); // Keep warning
           allHaveContent = false;
        }
      } catch (e) {
        console.error(`[forceCanvasVisibility] Error checking canvas ${layerId}:`, e); // Keep error
        allHaveContent = false;
      }
    } else {
      console.warn(`[forceCanvasVisibility] Layer ${layerId} missing image or draw method`); // Keep warning
      allHaveContent = false;
    }
  });

  // Keep final summary log
  console.log(`[forceCanvasVisibility] Final result: allHaveContent=${allHaveContent}`);
  return allHaveContent;
}