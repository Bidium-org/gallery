export async function uploadImages(
    files: File[],
  ): Promise<{ name: string; url: string }[]> {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)
  
    const response = await fetch('/api/images', { method: 'POST', body: formData })
    if (!response.ok) throw new Error('Image upload failed')
  
    const { images } = (await response.json()) as { images: { url: string }[] }
    return images.map((image, index) => ({ name: files[index].name, url: image.url }))
  }