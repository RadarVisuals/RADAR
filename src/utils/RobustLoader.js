/**
 * A Promise.allSettled wrapper that allows for retries on specific failed items.
 * Essential for IPFS/RPC heavy applications.
 */
export async function loadAssetsWithRetries(assets, loadFunction, concurrency = 5, retries = 3) {
    const results = new Map();
    const queue = [...assets];
    const activeWorkers = new Set();

    return new Promise((resolve) => {
        const next = async () => {
            if (queue.length === 0 && activeWorkers.size === 0) {
                resolve(Array.from(results.values()));
                return;
            }

            if (queue.length > 0 && activeWorkers.size < concurrency) {
                const item = queue.shift();
                const promise = (async () => {
                    let attempt = 0;
                    while (attempt < retries) {
                        try {
                            const result = await loadFunction(item);
                            results.set(item.id, { status: 'fulfilled', value: result, id: item.id });
                            return;
                        } catch (err) {
                            attempt++;
                            if (attempt >= retries) {
                                console.warn(`[RobustLoader] Failed to load ${item.id} after ${retries} attempts.`);
                                results.set(item.id, { status: 'rejected', reason: err, id: item.id });
                            } else {
                                // Exponential backoff: 200ms, 400ms, 800ms
                                await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
                            }
                        }
                    }
                })();

                activeWorkers.add(promise);
                await promise;
                activeWorkers.delete(promise);
                next();
            }
        };

        // Start initial workers
        for (let i = 0; i < concurrency; i++) next();
    });
}