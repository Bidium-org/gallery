import os from 'node:os'
import path from 'node:path'

export const GALLERY_DIR = path.join(os.homedir(), '.gallery')
export const DATA_DIR = process.env.GALLERY_DATA_DIR ?? path.join(GALLERY_DIR, 'data')
export const CANVAS_FOLDER = path.join(DATA_DIR, 'canvas')
export const IMAGES_FOLDER = path.join(DATA_DIR, 'images')
