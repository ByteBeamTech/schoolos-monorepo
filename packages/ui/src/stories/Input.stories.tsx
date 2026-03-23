import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '../components/Input'

const meta: Meta<typeof Input> = {
  title: 'SchoolOS/Input',
  component: Input,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Input>

export const Default:  Story = { args: { placeholder: 'Search students…' } }
export const WithLabel: Story = { args: { label: 'Student name', placeholder: 'Ravi Kumar' } }
export const Error:    Story = { args: { label: 'Email', placeholder: 'email@school.in', error: 'Invalid email address' } }
export const Disabled: Story = { args: { label: 'Tenant ID', value: 'abc-123', disabled: true } }
