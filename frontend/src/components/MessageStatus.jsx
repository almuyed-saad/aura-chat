import React from 'react'
import { FiCheck } from 'react-icons/fi'

const MessageStatus = ({ status }) => {
  if (status === 'read') {
    return (
      <span className="inline-flex -space-x-1.5 text-blue-400 dark:text-blue-400">
        <FiCheck className="w-3 h-3" strokeWidth={3} />
        <FiCheck className="w-3 h-3" strokeWidth={3} />
      </span>
    )
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex -space-x-1.5 opacity-70">
        <FiCheck className="w-3 h-3" strokeWidth={3} />
        <FiCheck className="w-3 h-3" strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className="inline-flex opacity-70">
      <FiCheck className="w-3 h-3" strokeWidth={3} />
    </span>
  )
}

export default MessageStatus