def ticket_payload(ticket) -> dict:
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "message": ticket.message,
        "order_id": ticket.order_id,
        "status": ticket.status,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "responses": [
            {
                "sender": response.sender,
                "message": response.message,
                "timestamp": response.created_at.isoformat(),
            }
            for response in ticket.responses.all()
        ],
    }
