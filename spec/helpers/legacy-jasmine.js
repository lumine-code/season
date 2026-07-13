const originalIt = global.it

global.it = (description, spec, timeout) =>
  originalIt(
    description,
    async function () {
      const steps = []
      const originalRuns = global.runs
      const originalWaitsFor = global.waitsFor

      global.runs = callback => steps.push({callback, type: 'run'})
      global.waitsFor = (predicate, message, waitTimeout = 5000) =>
        steps.push({message, predicate, timeout: waitTimeout, type: 'wait'})

      try {
        await spec.call(this)
        for (const step of steps) {
          if (step.type === 'run') {
            await step.callback()
            continue
          }

          const startTime = Date.now()
          while (!step.predicate()) {
            if (Date.now() - startTime >= step.timeout) {
              throw new Error(step.message || `Timed out after ${step.timeout} ms`)
            }
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }
      } finally {
        global.runs = originalRuns
        global.waitsFor = originalWaitsFor
      }
    },
    timeout
  )
