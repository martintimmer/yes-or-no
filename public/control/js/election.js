'use strict'
$(document).ready(() => {
    let req = false
    //detect locations hash 
    const loc = location.hash
    if(loc){
        if(!req){
            req = true
            $.ajax({
                url: `${loc.replace("#", "")}/`, 
                method: 'POST',
                timeout: 5000, 
                success: (res) => {
                    $(".main").fadeOut(10)
                    $(".loader").html(res)
                    location.hash = loc
                    req = false
                }, 
                error: (e) => {
                    req = false
                    if (e.statusText === 'timeout') {
                        toast.fire({
                            icon: 'error',
                            title: `Connection ${e.statusText}`,
                            timer: 2000
                        })
                    } else {
                        toast.fire({
                            icon: 'error',
                            title: `${e.status} ${e.statusText}`,
                            timer: 2000
                        })
                    }
                }
            })
        } else {
            toast.fire({
                icon: 'info',
                title: 'Please wait',
                timer: 2000
            })
        }
    } else {
        $(".main").fadeIn(500)
    }
    $(".open_settings").click(() => {
        const settings_parent = $(".settings")
        const settings_main = $(".settings_main")
        settings_parent.addClass("flex")
        settings_main.addClass(settings_main.attr("animate-in"))
        settings_parent.removeClass("hidden")
        setTimeout(() => {
            settings_main.removeClass(settings_main.attr("animate-in"))
        }, 500)
    })
    $(".settings").click(function (e) {
        const settings_parent = $(".settings")
        const settings_main = $(".settings_main")
        if ($(e.target).hasClass("settings")) {
            settings_main.addClass(settings_main.attr("animate-out"))
            setTimeout(() => {
                settings_parent.addClass("hidden")
                settings_parent.removeClass("flex")
                settings_main.removeClass(settings_main.attr("animate-out"))
            }, 500)
        }
    })
    $(".close_settings").click(() => {
        const settings_parent = $(".settings")
        const settings_main = $(".settings_main")
        settings_main.addClass(settings_main.attr("animate-out"))
        setTimeout(() => {
            settings_parent.addClass("hidden")
            settings_parent.removeClass("flex")
            settings_main.removeClass(settings_main.attr("animate-out"))
        }, 500)
    })
    $(".settings_btn").click( function(e){
        e.preventDefault() 
        const default_icon = $(this).find(".ic").html()
        const title = $(this).text()
        const icon = `<i style="font-size: 1.25rem;" class="fad fa-spin fa-spinner-third"></i>`
        $(this).find(".ic").html(icon)
        if(!req){
            req = true
            $.ajax({
                url: $(this).attr("data"), 
                method: 'POST',
                timeout: 5000, 
                success: (res) => {
                    $(".close_settings").click()
                    $(this).find(".ic").html(default_icon)
                    $(".main").fadeOut(10)
                    $(".loader").html(res)
                    location.hash = $(this).attr("data").replace("/", "")
                    req = false
                }, 
                error: (e) => {
                    req = false
                    $(this).find(".ic").html(default_icon)
                    if (e.statusText === 'timeout') {
                        toast.fire({
                            icon: 'error',
                            title: `Connection ${e.statusText}`,
                            timer: 2000
                        })
                    } else {
                        toast.fire({
                            icon: 'error',
                            title: `${e.status} ${e.statusText}`,
                            timer: 2000
                        })
                    }
                }
            })
        } else {
            toast.fire({
                icon: 'info',
                title: 'Please wait',
                timer: 2000
            })
        }
    })
    $(".loader").delegate(".return_main", "click", () => {
        $(".loader").html("")
        $(".main").fadeIn(100)
        location.hash = ""
    })
})