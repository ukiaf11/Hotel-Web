import { useEffect, useState } from 'react'

import { Icon } from '../../components/Icons'
import { MapPicker } from '../../components/MapPicker'
import { Alert, Button, Card, Skeleton, TextArea, TextInput } from '../../components/ui'
import { useSyncedState } from '../../hooks/useSyncedState'
import { errorMessage } from '../../services/errors'
import { useDistributorStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

interface FormShape {
  name: string
  place: string
  contact_number: string
  description: string
  cuisine: string
  opening_time: string
  closing_time: string
  latitude: number | null
  longitude: number | null
  google_map_url: string
  banner_image: string
  gallery_images: string[]
}

const EMPTY: FormShape = {
  name: '',
  place: '',
  contact_number: '',
  description: '',
  cuisine: '',
  opening_time: '09:00',
  closing_time: '22:00',
  latitude: null,
  longitude: null,
  google_map_url: '',
  banner_image: '',
  gallery_images: [],
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function HotelProfilePage() {
  const { hotel, fetchHotel, saveHotel } = useDistributorStore()
  const toast = useUIStore((state) => state.toast)

  const [form, setForm] = useSyncedState(hotel, (value) =>
    value
      ? {
          name: value.name,
          place: value.place,
          contact_number: value.contact_number,
          description: value.description,
          cuisine: value.cuisine,
          opening_time: value.opening_time.slice(0, 5),
          closing_time: value.closing_time.slice(0, 5),
          latitude: value.latitude,
          longitude: value.longitude,
          google_map_url: value.google_map_url ?? '',
          banner_image: value.banner_image,
          gallery_images: value.gallery_images ?? [],
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [timeError, setTimeError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (!hotel) void fetchHotel()
  }, [hotel, fetchHotel])

  const set = <K extends keyof FormShape>(key: K, value: FormShape[K]) => setForm((state) => ({ ...state, [key]: value }))

  /**
   * Files are read as data URLs and stored on the hotel record — this keeps uploads
   * working on the demo deployment where there is no media server.
   */
  const ingest = (files: FileList | null, target: 'banner' | 'gallery') => {
    if (!files?.length) return
    const accepted = [...files].filter((file) => {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        toast('warning', `${file.name} skipped`, 'Only JPG, PNG and WebP images are accepted.')
        return false
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast('warning', `${file.name} skipped`, 'Images must be 5 MB or smaller.')
        return false
      }
      return true
    })
    if (!accepted.length) return

    setUploadProgress(8)
    let done = 0
    accepted.forEach((file) => {
      const reader = new FileReader()
      reader.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 90))
      }
      reader.onload = () => {
        const url = String(reader.result)
        if (target === 'banner') set('banner_image', url)
        else setForm((state) => ({ ...state, gallery_images: [...state.gallery_images, url] }))
        done += 1
        setUploadProgress(done === accepted.length ? 100 : Math.round((done / accepted.length) * 100))
        if (done === accepted.length) setTimeout(() => setUploadProgress(0), 900)
      }
      reader.readAsDataURL(file)
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form.opening_time >= form.closing_time && form.closing_time !== '00:00') {
      setTimeError('Closing time must be after opening time.')
      return
    }
    setTimeError('')
    setSaving(true)
    try {
      await saveHotel({ ...form })
      toast('success', 'Profile updated', 'Your changes are live on the customer portal.')
    } catch (error) {
      toast('error', 'Could not save profile', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (!hotel) return <Skeleton height={420} />

  return (
    <form className="split-2" onSubmit={submit} style={{ alignItems: 'start' }}>
      <Card className="stack">
        <div className="panel-title">
          <h3>Hotel identity</h3>
        </div>
        <TextInput label="Hotel name" required value={form.name} onChange={(event) => set('name', event.target.value)} />
        <TextInput label="Contact telephone" placeholder="+91 98123 40001" value={form.contact_number} onChange={(event) => set('contact_number', event.target.value)} />
        <TextInput label="Cuisine tags" placeholder="North Indian • Mughlai" value={form.cuisine} onChange={(event) => set('cuisine', event.target.value)} />
        <TextArea label="Physical address" placeholder="Street, suite, area, city" value={form.place} onChange={(event) => set('place', event.target.value)} />
        <TextArea label="Short description" placeholder="What makes your kitchen special?" value={form.description} maxLength={280} onChange={(event) => set('description', event.target.value)} hint={`${form.description.length}/280`} />

        <div className="split-2">
          <TextInput label="Opening time" type="time" value={form.opening_time} onChange={(event) => set('opening_time', event.target.value)} error={timeError} />
          <TextInput label="Closing time" type="time" value={form.closing_time} onChange={(event) => set('closing_time', event.target.value)} />
        </div>
      </Card>

      <div className="stack">
        <Card className="stack">
          <div className="panel-title">
            <h3>Media assets</h3>
          </div>

          <label
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              ingest(event.dataTransfer.files, 'banner')
            }}
          >
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => ingest(event.target.files, 'banner')} />
            <Icon name="upload" size={24} />
            <p className="small strong">Drop your banner image here</p>
            <span className="tiny">JPG, PNG or WebP · up to 5 MB</span>
          </label>

          {uploadProgress ? (
            <div className="progress">
              <i style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}

          {form.banner_image ? (
            <div className="thumb" style={{ width: '100%', height: 150 }}>
              <img src={form.banner_image} alt="Banner preview" />
              <button type="button" onClick={() => set('banner_image', '')} aria-label="Remove banner">
                <Icon name="close" size={12} />
              </button>
            </div>
          ) : null}

          <label className="btn btn-secondary btn-sm" style={{ width: 'fit-content' }}>
            <Icon name="image" size={14} /> Add gallery images
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => ingest(event.target.files, 'gallery')} />
          </label>

          {form.gallery_images.length ? (
            <div className="thumb-row">
              {form.gallery_images.map((src, index) => (
                <div key={index} className="thumb">
                  <img src={src} alt={`Gallery ${index + 1}`} />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => set('gallery_images', form.gallery_images.filter((_, position) => position !== index))}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="stack">
          <div className="panel-title">
            <h3>Location pin</h3>
          </div>
          <MapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            searchable
            onPick={(latitude, longitude) => setForm((state) => ({ ...state, latitude, longitude }))}
            label="Drop your exact pin — customers open this from the hotel page"
          />
          <TextInput
            label="Custom Google Maps URL (optional)"
            placeholder="https://maps.app.goo.gl/…"
            value={form.google_map_url}
            onChange={(event) => set('google_map_url', event.target.value)}
            hint="Leave blank to auto-generate from your coordinates."
          />
          {form.latitude == null ? (
            <Alert tone="warning" icon="pin">
              No coordinates set yet — the “View on Google Maps” button will fall back to a name search.
            </Alert>
          ) : null}
        </Card>

        <Button type="submit" variant="primary" size="lg" loading={saving} icon="check">
          Save profile settings
        </Button>
      </div>
    </form>
  )
}
