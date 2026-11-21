(function () {
  const form=document.getElementById('registration-code-form');
  const input=document.getElementById('registration-code');
  const message=document.getElementById('registration-code-message');
  const next=document.getElementById('registration-continue');
  let lookupRequest=0;
  input.addEventListener('input',()=>{lookupRequest++;next.hidden=true;message.textContent='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const request=++lookupRequest;
    const code=input.value.replace(/[^a-z0-9]/gi,'').toUpperCase();
    next.hidden=true;message.textContent='Finding your facility...';window.AppFeedback?.dismiss('registration-code');
    const button=form.querySelector('button');button.disabled=true;
    try {
      const {data,error}=await db.rpc('lookup_registration_facility',{p_code:code});
      if(request!==lookupRequest) return;
      if(error) throw error;
      if(!data) throw new Error('That code is not active. Ask your facility for a registration code or link.');
      message.classList.remove('error-message');message.textContent=`Registering with ${data.facility_name}.`;
      next.href=`signup.html?code=${encodeURIComponent(code)}`;
      next.textContent=`Continue to ${data.facility_name}`;next.hidden=false;
    } catch(error) {
      if(request!==lookupRequest) return;
      message.textContent=error.message || 'Could not find your facility.';message.classList.add('error-message');window.AppFeedback?.error(message.textContent,{key:'registration-code',element:message});
    } finally {button.disabled=false;}
  });
})();
