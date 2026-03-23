import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../components/Button'

const meta: Meta<typeof Button> = {
  title: 'SchoolOS/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant:  { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    size:     { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    loading:  { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary:   Story = { args: { children: 'Save changes', variant: 'primary' } }
export const Secondary: Story = { args: { children: 'Cancel', variant: 'secondary' } }
export const Danger:    Story = { args: { children: 'Delete student', variant: 'danger' } }
export const Loading:   Story = { args: { children: 'Saving…', variant: 'primary', loading: true } }
export const Disabled:  Story = { args: { children: 'Unavailable', variant: 'primary', disabled: true } }
