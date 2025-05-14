// src/utils/forceCanvasVisibility.js

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
    if (import.meta.env.DEV) {
        console.warn("[forceCanvasVisibility] No managers provided.");
    }
    return false;
  }

  const managerEntries = Object.entries(managers);
  if (managerEntries.length === 0) {
    if (import.meta.env.DEV) {
        console.warn("[forceCanvasVisibility] Empty managers object.");
    }
    return false;
  }

  let allHaveContent = true;

  managerEntries.forEach(([layerId, manager]) => {
    if (!manager) {
      if (import.meta.env.DEV) {
        console.warn(`[forceCanvasVisibility] Missing manager for layer ${layerId}`);
      }
      allHaveContent = false;
      return; // Skip to next manager
    }

    const canvas = manager.canvas;
    if (!canvas) {
      if (import.meta.env.DEV) {
        console.warn(`[forceCanvasVisibility] Missing canvas for layer ${layerId}`);
      }
      allHaveContent = false;
      return; // Skip to next manager
    }

    // Apply styles directly to attempt making canvas visible
    // This is a debugging aid and overrides normal styling.
    if (canvas.style) {
      canvas.style.opacity = "1";
      canvas.style.display = "block"; // Ensure it's not display:none
      canvas.style.visibility = "visible";
      // Forcing position might interfere with layout, use with caution or make conditional
      // canvas.style.position = "absolute";
      // canvas.style.top = "0";
      // canvas.style.left = "0";
      // canvas.style.width = "100%"; // Or specific debug dimensions
      // canvas.style.height = "100%"; // Or specific debug dimensions
      canvas.classList.remove('hidden'); // Assuming 'hidden' class controls display:none or visibility
      canvas.classList.add('visible');   // Assuming 'visible' class ensures visibility

      // Styling parent might be too intrusive for a generic debug utility
      // if (canvas.parentElement) {
      //   canvas.parentElement.style.position = "relative";
      //   canvas.parentElement.style.width = "100%";
      //   canvas.parentElement.style.height = "100%";
      //   canvas.parentElement.style.overflow = "visible";
      // }
    }

    // Trigger a redraw and check content
    if (manager.image && manager.image.complete && typeof manager.draw === "function") {
      // Use drawStaticFrame if available for better consistency, otherwise fallback to draw
      const drawFn = typeof manager.drawStaticFrame === 'function' ? manager.drawStaticFrame : manager.draw;
      // Ensure the draw function is called with the manager's context.
      // drawStaticFrame is async, but for this debug tool, we might not await it.
      // If drawStaticFrame needs to be awaited, this function should be async.
      drawFn.call(manager, manager.config || {}); // Pass current config or an empty object

      try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          if (width > 0 && height > 0) {
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            const imageData = ctx.getImageData(centerX, centerY, 1, 1).data;
            // Check if pixel is not fully transparent black
            const hasContent = !(imageData[0] === 0 && imageData[1] === 0 && imageData[2] === 0 && imageData[3] === 0);

            if (import.meta.env.DEV) {
                // Keep the detailed log for debugging canvas state
                console.log(`[forceCanvasVisibility] Layer ${layerId}: Size: ${width}x${height}, CenterPixel: [${imageData.join(',')}], HasContent: ${hasContent}`);
            }

            if (!hasContent) {
              allHaveContent = false;
            }
          } else {
            if (import.meta.env.DEV) {
                console.warn(`[forceCanvasVisibility] Layer ${layerId} has zero dimensions: ${width}x${height}`);
            }
            allHaveContent = false;
          }
        } else {
           if (import.meta.env.DEV) {
               console.warn(`[forceCanvasVisibility] Could not get 2D context for layer ${layerId}`);
           }
           allHaveContent = false;
        }
      } catch (e) {
        if (import.meta.env.DEV) {
            console.error(`[forceCanvasVisibility] Error checking canvas ${layerId}:`, e);
        }
        allHaveContent = false;
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn(`[forceCanvasVisibility] Layer ${layerId} missing image, image not complete, or draw method not available.`);
      }
      allHaveContent = false;
    }
  });

  if (import.meta.env.DEV) {
    // Keep final summary log
    console.log(`[forceCanvasVisibility] Final result: allHaveContent=${allHaveContent}`);
  }
  return allHaveContent;
}