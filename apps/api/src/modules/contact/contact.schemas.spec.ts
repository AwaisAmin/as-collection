import { contactMessageSchema } from './contact.schemas.js';

const valid = {
  name: ' Ayesha Khan ',
  phone: '0300-1234567',
  email: '',
  topic: 'ORDER',
  orderNumber: 'as 261120 ab2cd',
  message: 'Where is my order?\r\nThanks',
};

describe('contactMessageSchema', () => {
  it('normalises phone, order number and text; blank email becomes null', () => {
    expect(contactMessageSchema.parse(valid)).toEqual({
      name: 'Ayesha Khan',
      phone: '+923001234567',
      email: null,
      topic: 'ORDER',
      orderNumber: 'AS-261120-AB2CD',
      message: 'Where is my order?\nThanks',
    });
  });

  it('requires a phone or an email', () => {
    const result = contactMessageSchema.safeParse({ ...valid, phone: '', email: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['phone']);
  });

  it('rejects malformed order numbers and unknown topics', () => {
    expect(contactMessageSchema.safeParse({ ...valid, orderNumber: '12345' }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valid, topic: 'SPAM' }).success).toBe(false);
  });
});
