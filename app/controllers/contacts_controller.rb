class ContactsController < ApplicationController
  # The list page: letter headings only. Each letter's contacts load lazily (see #section).
  def index
    @letter_counts = Contact.letter_counts
  end

  # One chunk of a letter section, rendered into the section's lazy-loading turbo-frame.
  # Continues after the contact at the `after` position, if given.
  def section
    @letter = params[:letter] == "other" ? "#" : params[:letter]
    after = decode_list_position(params[:after]) if params[:after].present?
    return head :bad_request if params[:after].present? && after.nil?

    @contacts, @more = Contact.section_chunk(@letter, after:)
    @frame_id = after ? section_frame_id(@letter, after: after.last) : section_frame_id(@letter)
    @remaining = Contact.in_section(@letter, after: @contacts.last.list_position).count if @more
  end

  def destroy
    # Once users exist (issue #8) this becomes current_user.contacts.find(...).
    @contact = Contact.find(params[:id])
    @contact.destroy!
    @undo_token = @contact.undo_token

    respond_to do |format|
      format.turbo_stream { @letter_counts = Contact.letter_counts }
      format.html do
        flash[:undo_token] = @undo_token
        redirect_to root_path, notice: "Contact deleted.", status: :see_other
      end
    end
  end

  # The "Undo" button in the banner after a delete.
  def restore
    @contact = Contact.restore_from_undo_token(params[:token])

    respond_to do |format|
      format.turbo_stream { @letter_counts = Contact.letter_counts }
      format.html do
        if @contact
          redirect_to root_path, notice: "Contact restored.", status: :see_other
        else
          redirect_to root_path, alert: "This contact can no longer be restored.", status: :see_other
        end
      end
    end
  end

  private

  def section_frame_id(letter, after: nil)
    helpers.section_frame_id(letter, after:)
  end

  # Inverse of ContactsHelper#encode_list_position. nil if it isn't a valid position.
  def decode_list_position(value)
    position = JSON.parse(Base64.urlsafe_decode64(value))
    position if position.is_a?(Array) && position.size == 4 && position.first(3).all?(String) && position.last.is_a?(Integer)
  rescue ArgumentError, JSON::ParserError
    nil
  end
end
