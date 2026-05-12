class Contacts::ContactableInboxesService
  pattr_initialize [:contact!]

  def get
    account = contact.account
    inboxes = account.inboxes.includes(:channel)

    # Batch-load all contact_inboxes for this contact in a single query
    # instead of one query per inbox (avoids N+1 in website and api inbox methods)
    @contact_inboxes_by_inbox_id = ContactInbox
      .where(contact: contact, inbox_id: inboxes.map(&:id))
      .order(:id)
      .group_by(&:inbox_id)
      .transform_values(&:last)

    # Batch-load which contact_inboxes already have conversations (for website inboxes)
    ci_ids = @contact_inboxes_by_inbox_id.values.map(&:id)
    @contact_inbox_ids_with_conversations = ci_ids.empty? ? Set.new :
      Set.new(Conversation.where(contact_inbox_id: ci_ids).distinct.pluck(:contact_inbox_id))

    inboxes.filter_map { |inbox| get_contactable_inbox(inbox) }
  end

  private

  def get_contactable_inbox(inbox)
    case inbox.channel_type
    when 'Channel::TwilioSms'
      twilio_contactable_inbox(inbox)
    when 'Channel::Whatsapp'
      whatsapp_contactable_inbox(inbox)
    when 'Channel::Sms'
      sms_contactable_inbox(inbox)
    when 'Channel::Email'
      email_contactable_inbox(inbox)
    when 'Channel::Api'
      api_contactable_inbox(inbox)
    when 'Channel::WebWidget'
      website_contactable_inbox(inbox)
    end
  end

  def website_contactable_inbox(inbox)
    latest_contact_inbox = @contact_inboxes_by_inbox_id[inbox.id]
    return unless latest_contact_inbox
    # FIXME : change this when multiple conversations comes in
    return if @contact_inbox_ids_with_conversations.include?(latest_contact_inbox.id)

    { source_id: latest_contact_inbox.source_id, inbox: inbox }
  end

  def api_contactable_inbox(inbox)
    latest_contact_inbox = @contact_inboxes_by_inbox_id[inbox.id]
    source_id = latest_contact_inbox&.source_id || SecureRandom.uuid

    { source_id: source_id, inbox: inbox }
  end

  def email_contactable_inbox(inbox)
    return unless @contact.email

    { source_id: @contact.email, inbox: inbox }
  end

  def whatsapp_contactable_inbox(inbox)
    return unless @contact.phone_number

    # Remove the plus since thats the format 360 dialog uses
    { source_id: @contact.phone_number.delete('+'), inbox: inbox }
  end

  def sms_contactable_inbox(inbox)
    return unless @contact.phone_number

    { source_id: @contact.phone_number, inbox: inbox }
  end

  def twilio_contactable_inbox(inbox)
    return if @contact.phone_number.blank?

    case inbox.channel.medium
    when 'sms'
      { source_id: @contact.phone_number, inbox: inbox }
    when 'whatsapp'
      { source_id: "whatsapp:#{@contact.phone_number}", inbox: inbox }
    end
  end
end
