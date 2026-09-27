import { describe, expect, it } from 'vitest'
import { PHOTOGRAPHER_CONTACT, contactLinks } from './contact'

describe('the photographer’s contact details', () => {
  it('ship empty, so nothing is shown until real details are supplied', () => {
    expect(PHOTOGRAPHER_CONTACT).toEqual({ name: null, phone: null, whatsapp: null, email: null })
    expect(contactLinks()).toEqual([])
  })

  it('link only the channels that are set', () => {
    expect(contactLinks({ name: null, phone: '+250 788 000 000', whatsapp: '+250 788 111 222', email: null })).toEqual([
      { kind: 'phone', value: '+250 788 000 000', href: 'tel:+250788000000' },
      { kind: 'whatsapp', value: '+250 788 111 222', href: 'https://wa.me/250788111222' },
    ])
    expect(contactLinks({ name: 'Studio', phone: null, whatsapp: null, email: 'hello@example.com' })).toEqual([
      { kind: 'email', value: 'hello@example.com', href: 'mailto:hello@example.com' },
    ])
  })
})
