function memoryRange(start, end, increment = 1) {
  const range = []

  for (let index = start; index <= end; index += increment) {
    range.push({ value: index * 1024, text: `${index} GB` })
  }

  return range
}

export { memoryRange }
