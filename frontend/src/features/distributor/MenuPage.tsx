import { useEffect, useMemo, useState } from 'react'

import { Icon } from '../../components/Icons'
import { Alert, Badge, Button, Card, EmptyState, Modal, Select, Skeleton, TextArea, TextInput, Toggle } from '../../components/ui'
import { money } from '../../lib/format'
import type { FoodItem } from '../../lib/types'
import { errorMessage } from '../../services/errors'
import { useMenuStore } from '../../store/distributor'
import { useUIStore } from '../../store/ui'

type Draft = Omit<FoodItem, 'id'> & { id?: number }

const BLANK: Draft = {
  name: '',
  description: '',
  price: 0,
  category: '',
  image: '',
  is_available: true,
  is_veg: true,
  is_custom_order: false,
  preparation_time_hours: 1,
}

export function MenuPage() {
  const { categories, items, isLoading, error, fetchMenu, saveItem, deleteItem, toggleStock, createCategory, deleteCategory } = useMenuStore()
  const { toast, askConfirm } = useUIStore()

  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [categoryModal, setCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    void fetchMenu()
  }, [fetchMenu])

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.category === filter)),
    [items, filter],
  )

  const openEditor = (item?: FoodItem) => {
    setDraft(item ? { ...item } : { ...BLANK, category: categories[0] ?? 'Main Course' })
    setFormError('')
    setModalOpen(true)
  }

  const save = async () => {
    if (!draft.name.trim()) {
      setFormError('Item name is required.')
      return
    }
    if (!(draft.price > 0)) {
      setFormError('Price must be greater than zero.')
      return
    }
    if (draft.is_custom_order && !(draft.preparation_time_hours > 0)) {
      setFormError('On-order items need a preparation lead time in hours.')
      return
    }
    setSaving(true)
    try {
      await saveItem(
        {
          ...draft,
          preparation_time_hours: draft.is_custom_order ? draft.preparation_time_hours : 0,
        },
        draft.id,
      )
      toast('success', draft.id ? 'Item updated' : 'Item added to your menu')
      setModalOpen(false)
    } catch (saveError) {
      setFormError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const remove = (item: FoodItem) =>
    askConfirm({
      title: `Delete “${item.name}”?`,
      body: 'Customers will no longer see this dish. Past orders keep their record.',
      confirmLabel: 'Delete item',
      danger: true,
      onConfirm: async () => {
        await deleteItem(item.id)
        toast('success', 'Menu item deleted')
      },
    })

  const flipStock = async (item: FoodItem) => {
    try {
      await toggleStock(item.id)
    } catch (stockError) {
      toast('error', 'Stock update failed', errorMessage(stockError))
    }
  }

  const addCategory = async () => {
    if (!newCategory.trim()) return
    try {
      await createCategory(newCategory.trim())
      toast('success', `Category “${newCategory.trim()}” created`)
      setNewCategory('')
      setCategoryModal(false)
    } catch (categoryError) {
      toast('error', 'Could not create category', errorMessage(categoryError))
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <Card className="stack">
        <div className="panel-title">
          <h3>Menu items &amp; categories</h3>
          <div className="row wrap">
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setCategoryModal(true)}>
              Create category
            </Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => openEditor()}>
              Add food item
            </Button>
          </div>
        </div>

        <div className="pill-group">
          <button className="pill" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All ({items.length})
          </button>
          {categories.map((category) => {
            const count = items.filter((item) => item.category === category).length
            return (
              <span key={category} className="row" style={{ gap: 2 }}>
                <button className="pill" aria-pressed={filter === category} onClick={() => setFilter(category)}>
                  {category} ({count})
                </button>
                {count === 0 ? (
                  <button
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    aria-label={`Delete ${category} category`}
                    onClick={() =>
                      askConfirm({
                        title: `Delete the “${category}” category?`,
                        body: 'Empty categories can be removed at any time.',
                        confirmLabel: 'Delete',
                        danger: true,
                        onConfirm: async () => {
                          await deleteCategory(category)
                          toast('success', 'Category removed')
                        },
                      })
                    }
                  >
                    <Icon name="close" size={12} />
                  </button>
                ) : null}
              </span>
            )
          })}
        </div>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {isLoading ? (
        <div className="item-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={150} />
          ))}
        </div>
      ) : visible.length ? (
        <div className="item-grid">
          {visible.map((item) => (
            <Card key={item.id} className="stack animate-in" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                {item.image ? (
                  <img className="food-thumb" src={item.image} alt="" loading="lazy" />
                ) : (
                  <div className="food-thumb center">
                    <Icon name="utensils" size={20} />
                  </div>
                )}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="food-title">
                    <span className={`veg-mark ${item.is_veg ? '' : 'nonveg'}`} />
                    <strong className="truncate">{item.name}</strong>
                  </div>
                  <span className="tiny muted">{item.category}</span>
                  <p className="price" style={{ marginTop: 4 }}>{money(item.price)}</p>
                </div>
              </div>

              {item.description ? <p className="tiny muted">{item.description}</p> : null}

              <Badge tone={item.is_custom_order ? 'badge-warning' : 'badge-info'} icon={item.is_custom_order ? 'clock' : 'fire'}>
                {item.is_custom_order ? `Pre-order · ${item.preparation_time_hours} hr lead` : 'Instant item'}
              </Badge>

              <div className="row-between wrap" style={{ paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border)' }}>
                <Toggle
                  checked={item.is_available}
                  onChange={() => void flipStock(item)}
                  label={item.is_available ? 'Available' : 'Out of stock'}
                />
                <div className="row" style={{ gap: 4 }}>
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => openEditor(item)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(item)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="utensils"
          title="No dishes in this category yet"
          body="Add your first item — set a price, mark it instant or on-order, and it appears on the customer menu immediately."
          action={<Button variant="primary" icon="plus" onClick={() => openEditor()}>Add food item</Button>}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={draft.id ? 'Edit menu item' : 'Add a new food item'} wide>
        <div className="stack">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <div className="split-2">
            <TextInput label="Item name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <TextInput
              label="Price"
              type="number"
              min={0.5}
              step={0.5}
              value={draft.price || ''}
              onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
            />
          </div>

          <div className="split-2">
            <Select
              label="Category"
              value={draft.category}
              options={[...new Set([...categories, draft.category].filter(Boolean))].map((category) => ({ value: category, label: category }))}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
            <TextInput label="Image URL" placeholder="https://…" value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} />
          </div>

          <TextArea
            label="Description"
            maxLength={200}
            hint={`${draft.description.length}/200 characters`}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />

          <div className="split-2">
            <Toggle checked={draft.is_veg} onChange={(is_veg) => setDraft({ ...draft, is_veg })} label="Vegetarian dish" brand />
            <Toggle checked={draft.is_available} onChange={(is_available) => setDraft({ ...draft, is_available })} label="In stock" />
          </div>

          <Card className="stack" style={{ background: 'var(--surface-sunken)' }}>
            <Toggle
              checked={draft.is_custom_order}
              onChange={(is_custom_order) => setDraft({ ...draft, is_custom_order })}
              label="On-order / custom dish (needs advance preparation)"
              brand
            />
            {draft.is_custom_order ? (
              <TextInput
                label="Preparation lead time (hours)"
                type="number"
                min={0.5}
                step={0.5}
                value={draft.preparation_time_hours || ''}
                hint="Customer time slots earlier than this lead time are disabled automatically."
                onChange={(event) => setDraft({ ...draft, preparation_time_hours: Number(event.target.value) })}
              />
            ) : (
              <p className="tiny muted">Instant items are prepared within the standard kitchen ticket time.</p>
            )}
          </Card>

          <Button variant="primary" block loading={saving} onClick={() => void save()}>
            {draft.id ? 'Save changes' : 'Add to menu'}
          </Button>
        </div>
      </Modal>

      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Create a category">
        <div className="stack">
          <TextInput
            label="Category name"
            placeholder="Desserts"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void addCategory()}
          />
          <Button variant="primary" block onClick={() => void addCategory()}>
            Create category
          </Button>
        </div>
      </Modal>
    </div>
  )
}
