interface DestroyableViewer {
  destroy(): void
}

function installBpmnJsdomShims(): () => void {
  const targets = [
    globalThis,
    HTMLCanvasElement.prototype,
    SVGElement.prototype,
    SVGSVGElement.prototype,
  ] as const
  const propertyNames = [
    ['SVGMatrix'],
    ['getContext'],
    ['getBBox', 'getCTM', 'transform'],
    ['createSVGMatrix', 'createSVGPoint', 'createSVGTransform', 'createSVGTransformFromMatrix'],
  ] as const
  const originalDescriptors = targets.map((target, index) => (
    propertyNames[index].map(propertyName => [
      propertyName,
      Object.getOwnPropertyDescriptor(target, propertyName),
    ] as const)
  ))

  class Matrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0

    inverse() { return this }
    multiply() { return this }
    translate(x: number, y: number) {
      this.e += x
      this.f += y
      return this
    }
    scale(factor: number) {
      this.a *= factor
      this.d *= factor
      return this
    }
  }
  const matrix = () => new Matrix()
  const svgTransform = (value = matrix()) => ({
    matrix: value,
    setTranslate(x: number, y: number) {
      value.e = x
      value.f = y
    },
    setScale(x: number, y: number) {
      value.a = x
      value.d = y
    },
    setRotate() {},
  })

  Object.defineProperty(globalThis, 'SVGMatrix', {
    configurable: true,
    value: Matrix,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      font: '',
      measureText: (text: string) => ({
        width: text.length * 7,
        actualBoundingBoxAscent: 9,
        actualBoundingBoxDescent: 3,
      }),
    }),
  })
  Object.defineProperties(SVGElement.prototype, {
    getBBox: {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 100, height: 20 }),
    },
    getCTM: { configurable: true, value: matrix },
    transform: {
      configurable: true,
      get: () => ({
        baseVal: {
          appendItem: (item: unknown) => item,
          clear: () => undefined,
          consolidate: () => svgTransform(),
          createSVGTransformFromMatrix: svgTransform,
        },
      }),
    },
  })
  Object.defineProperties(SVGSVGElement.prototype, {
    createSVGMatrix: { configurable: true, value: matrix },
    createSVGPoint: {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform: function () { return this },
      }),
    },
    createSVGTransform: {
      configurable: true,
      value: () => svgTransform(),
    },
    createSVGTransformFromMatrix: {
      configurable: true,
      value: svgTransform,
    },
  })

  return () => {
    targets.forEach((target, index) => {
      originalDescriptors[index].forEach(([propertyName, descriptor]) => {
        if (descriptor === undefined) {
          delete (target as unknown as Record<string, unknown>)[propertyName]
        } else {
          Object.defineProperty(target, propertyName, descriptor)
        }
      })
    })
  }
}

export async function withBpmnJsdomViewer<TViewer extends DestroyableViewer, TResult>(
  createViewer: (container: HTMLDivElement) => TViewer,
  run: (viewer: TViewer, container: HTMLDivElement) => Promise<TResult> | TResult,
): Promise<TResult> {
  let restoreShims: () => void = () => undefined
  let container: HTMLDivElement | undefined
  let viewer: TViewer | undefined

  try {
    restoreShims = installBpmnJsdomShims()
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '500px'
    document.body.append(container)
    viewer = createViewer(container)
    return await run(viewer, container)
  } finally {
    try {
      viewer?.destroy()
    } finally {
      try {
        container?.remove()
      } finally {
        restoreShims()
      }
    }
  }
}
